import Redis from 'ioredis'
import { Agent } from '@atproto/api'
import { DAY } from '@atproto/common'
import { OAuthScope } from '@atproto/oauth-provider'
import { CachedGetter } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'

const PREFIX = 'ref:'

type ScopeReference = `${typeof PREFIX}${string}`
export const isScopeReference = (scope: string): scope is ScopeReference =>
  scope.startsWith(PREFIX) && !scope.includes(' ')

const identity = <T>(value: T): T => value

export class ScopeReferenceGetter extends CachedGetter<
  ScopeReference,
  OAuthScope
> {
  constructor(entrywayAgent: Agent, redis?: Redis) {
    super(
      async (scope, { signal, noCache }) => {
        const response = await entrywayAgent.com.atproto.temp.dereferenceScope(
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

            keyPrefix: `auth-scope-${PREFIX}`,
            encode: identity,
            decode: identity,
          })
        : new SimpleStoreMemory({ max: 1000 }),
    )
  }

  async dereference(scope: string): Promise<string> {
    const values = scope.split(' ')

    const references = values.filter(isScopeReference)
    if (!references.length) return scope

    const decoded = new Map<string, OAuthScope>(
      await Promise.all(
        references.map(async (ref) => [ref, await this.get(ref)] as const),
      ),
    )

    return Array.from(values, (value) => decoded.get(value) ?? value).join(' ')
  }
}
