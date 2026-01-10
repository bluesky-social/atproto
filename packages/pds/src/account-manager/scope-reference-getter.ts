import Redis from 'ioredis'
import { Agent, ComAtprotoTempDereferenceScope } from '@atproto/api'
import { DAY, backoffMs, retry } from '@atproto/common'
import { InvalidTokenError, OAuthScope } from '@atproto/oauth-provider'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { CachedGetter, GetterOptions } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { SimpleStoreRedis } from '@atproto-labs/simple-store-redis'
import { oauthLogger } from '../logger.js'

const { InvalidScopeReferenceError } = ComAtprotoTempDereferenceScope
const PREFIX = 'ref:'

type ScopeReference = `${typeof PREFIX}${string}`
const isScopeReference = (scope?: OAuthScope): scope is ScopeReference =>
  scope != null && scope.startsWith(PREFIX) && !scope.includes(' ')

const identity = <T>(value: T): T => value

export class ScopeReferenceGetter extends CachedGetter<
  ScopeReference,
  OAuthScope
> {
  constructor(
    protected readonly entryway: Agent,
    redis?: Redis,
  ) {
    super(
      async (ref, options) => {
        return retry(async () => this.fetchDereferencedScope(ref, options), {
          maxRetries: 3,
          getWaitMs: (n) => backoffMs(n, 250, 2000),
          retryable: (err) =>
            !options?.signal?.aborted &&
            !(err instanceof InvalidScopeReferenceError),
        })
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

  protected async fetchDereferencedScope(
    ref: ScopeReference,
    opts?: GetterOptions,
  ): Promise<OAuthScope> {
    oauthLogger.info({ ref }, 'Fetching scope reference')

    try {
      const response = await this.entryway.com.atproto.temp.dereferenceScope(
        { scope: ref },
        {
          signal: opts?.signal,
          headers: opts?.noCache ? { 'Cache-Control': 'no-cache' } : undefined,
        },
      )

      const { scope } = response.data

      oauthLogger.info({ ref, scope }, 'Successfully fetched scope reference')

      // @NOTE the part after `PREFIX` (in the input scope) is the CID of the
      // scope string returned by entryway. Since there is a trust
      // relationship with the entryway, we don't need to verify or enforce
      // that here.

      return scope
    } catch (err) {
      oauthLogger.error({ err, ref }, 'Failed to fetch scope reference')

      throw err
    }
  }

  async dereference(scope?: OAuthScope): Promise<undefined | OAuthScope> {
    oauthLogger.debug({ scope }, 'Dereferencing scope')

    if (!isScopeReference(scope)) return scope
    return this.get(scope).catch(handleDereferenceError)
  }
}

function handleDereferenceError(cause: unknown): never {
  if (cause instanceof InvalidScopeReferenceError) {
    // The scope reference cannot be found on the server.
    // Consider the session as invalid, allowing entryway to
    // re-build the scope as the user re-authenticates. This
    // should never happen though.
    throw InvalidTokenError.from(cause, 'DPoP')
  }

  throw new UpstreamFailureError(
    'Failed to fetch token permissions',
    undefined,
    { cause },
  )
}
