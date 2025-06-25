import { AtprotoDid } from '@atproto/did'
import { Key } from '@atproto/jwk'
import {
  CachedGetter,
  GetCachedOptions,
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
import { CustomEventTarget, combineSignals, timeoutSignal } from './util.js'

export type Session = {
  dpopKey: Key
  /**
   * Previous implementation of this lib did not define an `authMethod`
   */
  authMethod?: ClientAuthMethod
  tokenSet: TokenSet
}

export type SessionStore = SimpleStore<string, Session>

export type SessionEventMap = {
  updated: {
    sub: string
  } & Session
  deleted: {
    sub: string
    cause: TokenRefreshError | TokenRevokedError | TokenInvalidError | unknown
  }
}

export type SessionEventListener<
  T extends keyof SessionEventMap = keyof SessionEventMap,
> = (event: CustomEvent<SessionEventMap[T]>) => void

/**
 * There are several advantages to wrapping the sessionStore in a (single)
 * CachedGetter, the main of which is that the cached getter will ensure that at
 * most one fresh call is ever being made. Another advantage, is that it
 * contains the logic for reading from the cache which, if the cache is based on
 * localStorage/indexedDB, will sync across multiple tabs (for a given sub).
 */
export class SessionGetter extends CachedGetter<AtprotoDid, Session> {
  private readonly eventTarget = new CustomEventTarget<SessionEventMap>()

  constructor(
    sessionStore: SessionStore,
    serverFactory: OAuthServerFactory,
    private readonly runtime: Runtime,
  ) {
    super(
      async (sub, options, storedSession) => {
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
          this.dispatchEvent('deleted', { sub, cause })
          throw cause
        }

        // From this point forward, throwing a TokenRefreshError will result in
        // this.delStored() being called, resulting in an event being
        // dispatched, even if the session was removed from the store through a
        // concurrent access (which, normally, should not happen if a proper
        // runtime lock was provided).

        const { dpopKey, authMethod = 'legacy', tokenSet } = storedSession

        if (sub !== tokenSet.sub) {
          // Fool-proofing (e.g. against invalid session storage)
          throw new TokenRefreshError(sub, 'Stored session sub mismatch')
        }

        if (!tokenSet.refresh_token) {
          throw new TokenRefreshError(sub, 'No refresh token available')
        }

        // Since refresh tokens can only be used once, we might run into
        // concurrency issues if multiple instances (e.g. browser tabs) are
        // trying to refresh the same token simultaneously. The chances of this
        // happening when multiple instances are started simultaneously is
        // reduced by randomizing the expiry time (see isStale() below). The
        // best solution is to use a mutex/lock to ensure that only one instance
        // is refreshing the token at a time (runtime.usingLock) but that is not
        // always possible. If no lock implementation is provided, we will use
        // the store to check if a concurrent refresh occurred.

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
        options?.signal?.throwIfAborted()

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
          // If the refresh token is invalid, let's try to recover from
          // concurrency issues, or make sure the session is deleted by throwing
          // a TokenRefreshError.
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
        onStoreError: async (
          err,
          sub,
          { tokenSet, dpopKey, authMethod = 'legacy' as const },
        ) => {
          if (!(err instanceof AuthMethodUnsatisfiableError)) {
            // If the error was an AuthMethodUnsatisfiableError, there is no
            // point in trying to call `fromIssuer`.
            try {
              // If the token data cannot be stored, let's revoke it
              const server = await serverFactory.fromIssuer(
                tokenSet.iss,
                authMethod,
                dpopKey,
              )
              await server.revoke(
                tokenSet.refresh_token ?? tokenSet.access_token,
              )
            } catch {
              // Let the original error propagate
            }
          }

          throw err
        },
        deleteOnError: async (err) =>
          err instanceof TokenRefreshError ||
          err instanceof TokenRevokedError ||
          err instanceof TokenInvalidError ||
          err instanceof AuthMethodUnsatisfiableError,
      },
    )
  }

  addEventListener<T extends keyof SessionEventMap>(
    type: T,
    callback: SessionEventListener<T>,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.eventTarget.addEventListener(type, callback, options)
  }

  removeEventListener<T extends keyof SessionEventMap>(
    type: T,
    callback: SessionEventListener<T>,
    options?: EventListenerOptions | boolean,
  ) {
    this.eventTarget.removeEventListener(type, callback, options)
  }

  dispatchEvent<T extends keyof SessionEventMap>(
    type: T,
    detail: SessionEventMap[T],
  ): boolean {
    return this.eventTarget.dispatchCustomEvent(type, detail)
  }

  async setStored(sub: string, session: Session) {
    // Prevent tampering with the stored value
    if (sub !== session.tokenSet.sub) {
      throw new TypeError('Token set does not match the expected sub')
    }
    await super.setStored(sub, session)
    this.dispatchEvent('updated', { sub, ...session })
  }

  override async delStored(sub: AtprotoDid, cause?: unknown): Promise<void> {
    await super.delStored(sub, cause)
    this.dispatchEvent('deleted', { sub, cause })
  }

  /**
   * @param refresh When `true`, the credentials will be refreshed even if they
   * are not expired. When `false`, the credentials will not be refreshed even
   * if they are expired. When `undefined`, the credentials will be refreshed
   * if, and only if, they are (about to be) expired. Defaults to `undefined`.
   */
  async getSession(sub: AtprotoDid, refresh?: boolean) {
    return this.get(sub, {
      noCache: refresh === true,
      allowStale: refresh === false,
    })
  }

  async get(sub: AtprotoDid, options?: GetCachedOptions): Promise<Session> {
    const session = await this.runtime.usingLock(
      `@atproto-oauth-client-${sub}`,
      async () => {
        // Make sure, even if there is no signal in the options, that the
        // request will be cancelled after at most 30 seconds.
        using signal = timeoutSignal(30e3, options)

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
}
