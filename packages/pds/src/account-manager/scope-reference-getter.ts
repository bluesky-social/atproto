import Redis from 'ioredis'
import { Agent } from '@atproto/api'
import { DAY } from '@atproto/common'
import { OAuthScope } from '@atproto/oauth-provider'
import { CachedGetter } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'

const PREFIX = 'ref:'

type ScopeReference = `${typeof PREFIX}${string}`
const isScopeReference = (scope?: OAuthScope): scope is ScopeReference =>
  scope != null && scope.startsWith(PREFIX) && !scope.includes(' ')

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

        // @NOTE the part after `PREFIX` (in the input scope) is the CID of the
        // scope string returned by entryway. Since there is a trust
        // relationship with the entryway, we don't need to verify or enforce
        // that here.

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

  async dereference(scope?: OAuthScope): Promise<undefined | OAuthScope> {
    if (isScopeReference(scope)) return this.get(scope)
    return scope
  }
}
