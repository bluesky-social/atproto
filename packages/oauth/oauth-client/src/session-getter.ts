import { AtprotoDid } from '@atproto/did'
import { Key } from '@atproto/jwk'
import {
  CachedGetter,
  GetCachedOptions,
  GetOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import { AuthMethodUnsatisfiableError } from './errors/auth-method-unsatisfiable-error.js'
import { TokenInvalidError } from './errors/token-invalid-error.js'
import { TokenRefreshError } from './errors/token-refresh-error.js'
import { TokenRevokedError } from './errors/token-revoked-error.js'
import { ClientAuthMethod } from './oauth-client-auth.js'
import { OAuthResponseError } from './oauth-response-error.js'
import { TokenSet } from './oauth-server-agent.js'
import { OAuthServerFactory } from './oauth-server-factory.js'
import { Runtime } from './runtime.js'
import { combineSignals } from './util.js'

export type Session = {
  dpopKey: Key
  authMethod: ClientAuthMethod
  tokenSet: TokenSet
}

export type SessionStore = SimpleStore<string, Session>

export type SessionHooks = {
  onUpdate?: (sub: AtprotoDid, session: Session) => void
  onDelete?: (
    sub: AtprotoDid,
    cause: TokenRefreshError | TokenRevokedError | TokenInvalidError | unknown,
  ) => void
}

export function isExpectedSessionError(err: unknown) {
  return (
    err instanceof TokenRefreshError ||
    err instanceof TokenRevokedError ||
    err instanceof TokenInvalidError ||
    err instanceof AuthMethodUnsatisfiableError ||
    // The stored session is invalid (e.g. missing properties) and cannot
    // be used properly
    err instanceof TypeError
  )
}

/**
 * There are several advantages to wrapping the sessionStore in a (single)
 * CachedGetter, the main of which is that the cached getter will ensure that at
 * most one fresh call is ever being made. Another advantage, is that it
 * contains the logic for reading from the cache which, if the cache is based on
 * localStorage/indexedDB, will sync across multiple tabs (for a given sub).
 */
export class SessionGetter extends CachedGetter<AtprotoDid, Session> {
  constructor(
    sessionStore: SessionStore,
    serverFactory: OAuthServerFactory,
    private readonly runtime: Runtime,
    private readonly hooks: SessionHooks = {},
  ) {
    super(
      async (sub, { signal }, storedSession) => {
        // There needs to be a previous session to be able to refresh. If
        // storedSession is undefined, it means that the store does not contain
        // a session for the given sub.
        if (storedSession === undefined) {
          // Because the session is not in the store, this.delStored() method
          // will not be called by the CachedGetter class (because there is
          // nothing to delete). This would typically happen if there is no
          // synchronization mechanism between instances of this class. Let's
          // make sure an event is dispatched here if this occurs.
          const msg = 'The session was deleted by another process'
          const cause = new TokenRefreshError(sub, msg)
          await hooks.onDelete?.call(null, sub, cause)
          throw cause
        }

        // @NOTE Throwing a TokenRefreshError (or any other error class defined
        // in the deleteOnError options) will result in this.delStored() being
        // called.

        const { dpopKey, authMethod, tokenSet } = storedSession

        if (sub !== tokenSet.sub) {
          // Fool-proofing (e.g. against invalid session storage)
          throw new TokenRefreshError(sub, 'Stored session sub mismatch')
        }

        if (!tokenSet.refresh_token) {
          throw new TokenRefreshError(sub, 'No refresh token available')
        }

        const server = await serverFactory.fromIssuer(
          tokenSet.iss,
          authMethod,
          dpopKey,
        )

        // Because refresh tokens can only be used once, we must not use the
        // "signal" to abort the refresh, or throw any abort error beyond this
        // point. Any thrown error beyond this point will prevent the
        // TokenGetter from obtaining, and storing, the new token set,
        // effectively rendering the currently saved session unusable.
        signal?.throwIfAborted()

        try {
          const newTokenSet = await server.refresh(tokenSet)

          if (sub !== newTokenSet.sub) {
            // The server returned another sub. Was the tokenSet manipulated?
            throw new TokenRefreshError(sub, 'Token set sub mismatch')
          }

          return {
            dpopKey,
            tokenSet: newTokenSet,
            authMethod: server.authMethod,
          }
        } catch (cause) {
          // Since refresh tokens can only be used once, we might run into
          // concurrency issues if multiple instances (e.g. browser tabs) are
          // trying to refresh the same token simultaneously. The chances of
          // this happening when multiple instances are started simultaneously
          // is reduced by randomizing the expiry time (see isStale() below).
          // The best solution is to use a mutex/lock to ensure that only one
          // instance is refreshing the token at a time (runtime.usingLock) but
          // that is not always possible. Let's try to recover from concurrency
          // issues, or force the session to be deleted by throwing a
          // TokenRefreshError.
          if (
            cause instanceof OAuthResponseError &&
            cause.status === 400 &&
            cause.error === 'invalid_grant'
          ) {
            // In case there is no lock implementation in the runtime, we will
            // wait for a short time to give the other concurrent instances a
            // chance to finish their refreshing of the token. If a concurrent
            // refresh did occur, we will pretend that this one succeeded.
            if (!runtime.hasImplementationLock) {
              await new Promise((r) => setTimeout(r, 1000))

              const stored = await this.getStored(sub)
              if (stored === undefined) {
                // A concurrent refresh occurred and caused the session to be
                // deleted (for a reason we can't know at this point).

                // Using a distinct error message mainly for debugging
                // purposes. Also, throwing a TokenRefreshError to trigger
                // deletion through the deleteOnError callback.
                const msg = 'The session was deleted by another process'
                throw new TokenRefreshError(sub, msg, { cause })
              } else if (
                stored.tokenSet.access_token !== tokenSet.access_token ||
                stored.tokenSet.refresh_token !== tokenSet.refresh_token
              ) {
                // A concurrent refresh occurred. Pretend this one succeeded.
                return stored
              } else {
                // There were no concurrent refresh. The token is (likely)
                // simply no longer valid.
              }
            }

            // Make sure the session gets deleted from the store
            const msg = cause.errorDescription ?? 'The session was revoked'
            throw new TokenRefreshError(sub, msg, { cause })
          }

          throw cause
        }
      },
      sessionStore,
      {
        isStale: (sub, { tokenSet }) => {
          return (
            tokenSet.expires_at != null &&
            new Date(tokenSet.expires_at).getTime() <
              Date.now() +
                // Add some lee way to ensure the token is not expired when it
                // reaches the server.
                10e3 +
                // Add some randomness to reduce the chances of multiple
                // instances trying to refresh the token at the same.
                30e3 * Math.random()
          )
        },
        onStoreError: async (err, sub, { tokenSet, dpopKey, authMethod }) => {
          // If the token data cannot be stored, let's revoke it
          try {
            const server = await serverFactory.fromIssuer(
              tokenSet.iss,
              authMethod,
              dpopKey,
            )
            await server.revoke(tokenSet.refresh_token ?? tokenSet.access_token)
          } catch {
            // At least we tried...
          }

          // Attempt to delete the session from the store. Note that this might
          // fail if the store is not available, which is fine.
          try {
            await this.delStored(sub, err)
          } catch {
            // Ignore (better to propagate the original storage error)
          }

          throw err
        },
        deleteOnError: isExpectedSessionError,
      },
    )
  }

  override async getStored(
    sub: AtprotoDid,
    options?: GetOptions,
  ): Promise<Session | undefined> {
    return super.getStored(sub, options)
  }

  override async setStored(sub: AtprotoDid, session: Session) {
    // Prevent tampering with the stored value
    if (sub !== session.tokenSet.sub) {
      throw new TypeError('Token set does not match the expected sub')
    }
    await super.setStored(sub, session)
    await this.hooks.onUpdate?.call(null, sub, session)
  }

  override async delStored(sub: AtprotoDid, cause?: unknown): Promise<void> {
    await super.delStored(sub, cause)
    await this.hooks.onDelete?.call(null, sub, cause)
  }

  /**
   * @deprecated Use {@link getSession} instead
   * @internal (not really deprecated)
   */
  override async get(
    sub: AtprotoDid,
    options?: GetCachedOptions,
  ): Promise<Session> {
    const session = await this.runtime.usingLock(
      `@atproto-oauth-client-${sub}`,
      async () => {
        // Make sure, even if there is no signal in the options, that the
        // request will be cancelled after at most 30 seconds.
        const signal = AbortSignal.timeout(30e3)

        using abortController = combineSignals([options?.signal, signal])

        return await super.get(sub, {
          ...options,
          signal: abortController.signal,
        })
      },
    )

    if (sub !== session.tokenSet.sub) {
      // Fool-proofing (e.g. against invalid session storage)
      throw new Error('Token set does not match the expected sub')
    }

    return session
  }

  /**
   * @param refresh When `true`, the credentials will be refreshed even if they
   * are not expired. When `false`, the credentials will not be refreshed even
   * if they are expired. When `undefined`, the credentials will be refreshed
   * if, and only if, they are (about to be) expired. Defaults to `undefined`.
   */
  async getSession(sub: AtprotoDid, refresh: boolean | 'auto' = 'auto') {
    return this.get(sub, {
      noCache: refresh === true,
      allowStale: refresh === false,
    })
  }
}
