import Redis from 'ioredis'
import { Agent } from '@atproto/api'
import { DAY } from '@atproto/common'
import { OAuthScope } from '@atproto/oauth-provider'
import { CachedGetter } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'

type EncodedScope = `enc:${string}`
export const isEncodedScope = (scope: unknown): scope is EncodedScope =>
  typeof scope === 'string' && scope.startsWith('enc:') && !scope.includes(' ')

const identity = <T>(value: T): T => value

export class ScopeDecoder extends CachedGetter<EncodedScope, OAuthScope> {
  constructor(entrywayAgent: Agent, redis?: Redis) {
    super(
      async (scope, { signal, noCache }) => {
        const response = await entrywayAgent.com.atproto.temp.decodeScope(
          { scope },
          {
            signal,
            headers: noCache ? { 'Cache-Control': 'no-cache' } : undefined,
          },
        )

        // @NOTE the part after `enc:` is the CID of the actual scope string.
        // Since there is a trust relationship with the entryway, we don't need
        // to check/enforce that here.

        return response.data.scope
      },
      redis
        ? new SimpleStoreRedis(redis, {
            // tradeoff between wasted memory usage (by no longer used scopes)
            // and amount of requests to entryway:
            ttl: 1 * DAY,

            keyPrefix: 'enc-auth-scope:',
            encode: identity,
            decode: identity,
          })
        : new SimpleStoreMemory({ max: 1000 }),
    )
  }
}
