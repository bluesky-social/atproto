import {
  Agent,
  XrpcFailure,
  buildAgent,
  xrpc,
  xrpcSafe,
} from '@atproto/lex-client'
import { LexAuthFactorError } from './error.js'
import { com } from './lexicons/index.js'
import { extractPdsUrl, extractXrpcErrorCode } from './util.js'

/**
 * Represents a failure response when refreshing a session.
 *
 * This type captures the possible error responses from
 * `com.atproto.server.refreshSession`, including both expected errors
 * (e.g., invalid/expired refresh token) and unexpected errors (e.g., network issues).
 */
export type RefreshFailure = XrpcFailure<
  typeof com.atproto.server.refreshSession.main
>

/**
 * Represents a failure response when deleting a session.
 *
 * This type captures the possible error responses from
 * `com.atproto.server.deleteSession`, including both expected errors
 * and unexpected errors (e.g., network issues, server unavailability).
 */
export type DeleteFailure = XrpcFailure<
  typeof com.atproto.server.deleteSession.main
>

/**
 * Persisted session data containing authentication credentials and service information.
 *
 * This type extends the response from `com.atproto.server.createSession` with the
 * service URL used for authentication. Store this data securely to resume sessions
 * later without re-authenticating.
 */
export type SessionData = com.atproto.server.createSession.$OutputBody & {
  service: string
}

export type PasswordSessionOptions = {
  /**
   * Custom fetch implementation to use for network requests
   */
  fetch?: typeof globalThis.fetch

  /**
   * Called whenever the session is successfully created/refreshed, and new
   * credentials have been obtained. Use this hook to persist the updated
   * session information.
   *
   * If this callback returns a promise, this function will never be called
   * again (on the same process) until the promise resolves.
   *
   * @note this function **must** not throw
   */
  onUpdated?: (this: PasswordSession, data: SessionData) => void | Promise<void>

  /**
   * Called whenever the session update fails due to an expected error, such as
   * a network issue or server unavailability. This function can be used to log
   * the error or notify the user, but should not assume that the session is
   * invalid.
   *
   * @note this function **must** not throw
   */
  onUpdateFailure?: (
    this: PasswordSession,
    data: SessionData,
    err: RefreshFailure,
  ) => void | Promise<void>

  /**
   * Called whenever the session is deleted, either due to an explicit logout or
   * because the refresh operation indicated that the session is no longer
   * valid. Use this hook to clean up any persisted session information and
   * update the application state accordingly.
   *
   * @note this function **must** not throw
   */
  onDeleted?: (this: PasswordSession, data: SessionData) => void | Promise<void>

  /**
   * Called whenever a session deletion fails due to an unexpected error, such
   * as a network issue or server unavailability. This function can be used to
   * log the error or notify the user. When this function is called, the session
   * might still be valid on the server. It is up to the implementation to
   * decide whether to retry the deletion or keep the session active. Ignoring
   * these errors is not recommended as it can lead to orphaned sessions on the
   * server, or security issues if the user believes they have logged out when a
   * bad actor is still using the session. The implementation should consider
   * keeping track of failed deletions and retrying them later, until they
   * succeed.
   *
   * @note this function **must** not throw
   */
  onDeleteFailure?: (
    this: PasswordSession,
    data: SessionData,
    err: DeleteFailure,
  ) => void | Promise<void>
}

/**
 * Password-based authentication session for AT Protocol services.
 *
 * This class provides session management for CLI tools, scripts, and bots that
 * need to authenticate with AT Protocol services using password credentials.
 * It implements the {@link Agent} interface, allowing it to be used directly
 * with AT Protocol clients.
 *
 * **Security Warning:** It is strongly recommended to use app passwords instead
 * of main account credentials. App passwords provide limited access and can be
 * revoked independently without compromising your main account. For browser-based
 * applications, use OAuth-based authentication instead.
 *
 * @example Basic usage with app password
 * ```ts
 * const session = await PasswordSession.login({
 *   service: 'https://bsky.social',
 *   identifier: 'alice.bsky.social',
 *   password: 'xxxx-xxxx-xxxx-xxxx', // App password
 *   onUpdated: (data) => saveToStorage(data),
 *   onDeleted: (data) => clearStorage(data.did),
 * })
 *
 * const client = new Client(session)
 * // Use client to make authenticated requests
 * ```
 *
 * @example Resuming a persisted session
 * ```ts
 * const savedData = JSON.parse(fs.readFileSync('session.json', 'utf8'))
 * const session = await PasswordSession.resume(savedData, {
 *   onUpdated: (data) => saveToStorage(data),
 *   onDeleted: (data) => clearStorage(data.did),
 * })
 * ```
 *
 * @implements {Agent}
 */
export class PasswordSession implements Agent {
  /**
   * Internal {@link Agent} used for session management towards the
   * authentication service only.
   */
  #serviceAgent: Agent

  #sessionData: null | SessionData
  #sessionPromise: Promise<SessionData>

  constructor(
    sessionData: SessionData,
    protected readonly options: PasswordSessionOptions = {},
  ) {
    this.#serviceAgent = buildAgent({
      service: sessionData.service,
      fetch: options.fetch,
    })

    this.#sessionData = sessionData
    this.#sessionPromise = Promise.resolve(this.#sessionData)
  }

  /**
   * The DID (Decentralized Identifier) of the authenticated account.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get did() {
    return this.session.did
  }

  /**
   * The handle (username) of the authenticated account.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get handle() {
    return this.session.handle
  }

  /**
   * The current session data containing authentication credentials.
   *
   * @throws {Error} If the session has been destroyed (logged out).
   */
  get session() {
    if (this.#sessionData) return this.#sessionData
    throw new Error('Logged out')
  }

  /**
   * Whether this session has been destroyed (logged out).
   *
   * Once destroyed, this session instance can no longer be used for
   * authenticated requests. Create a new session via {@link PasswordSession.login}
   * or {@link PasswordSession.resume}.
   */
  get destroyed(): boolean {
    return this.#sessionData === null
  }

  /**
   * Handles authenticated fetch requests to the user's PDS.
   *
   * This method implements the {@link Agent} interface and is called by
   * AT Protocol clients to make authenticated requests. It automatically:
   * - Adds the access token to request headers
   * - Detects expired tokens and triggers refresh
   * - Retries requests after successful token refresh
   *
   * @param path - The request path (will be resolved against the PDS URL)
   * @param init - Standard fetch RequestInit options (headers, body, etc.)
   * @returns The fetch Response from the PDS
   * @throws {TypeError} If an 'authorization' header is already set in init
   */
  async fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (headers.has('authorization')) {
      throw new TypeError("Unexpected 'authorization' header set")
    }

    const sessionPromise = this.#sessionPromise
    const sessionData = await sessionPromise

    const fetch = this.options.fetch ?? globalThis.fetch

    headers.set('authorization', `Bearer ${sessionData.accessJwt}`)
    const initialRes = await fetch(fetchUrl(sessionData, path), {
      ...init,
      headers,
    })

    const refreshNeeded =
      initialRes.status === 401 ||
      (initialRes.status === 400 &&
        (await extractXrpcErrorCode(initialRes)) === 'ExpiredToken')

    if (!refreshNeeded) {
      return initialRes
    }

    // Refresh session (unless it was already refreshed in the meantime)
    const newSessionPromise =
      this.#sessionPromise === sessionPromise
        ? this.refresh()
        : this.#sessionPromise

    // Error should have been propagated through hooks
    const newSessionData = await newSessionPromise.catch((_err) => null)
    if (!newSessionData) {
      return initialRes
    }

    // refresh silently failed, no point in retrying.
    if (newSessionData.accessJwt === sessionData.accessJwt) {
      return initialRes
    }

    if (init?.signal?.aborted) {
      return initialRes
    }

    // The stream was already consumed. We cannot retry the request. A solution
    // would be to tee() the input stream but that would bufferize the entire
    // stream in memory which can lead to memory starvation. Instead, we will
    // return the original response and let the calling code handle retries.
    if (ReadableStream && init?.body instanceof ReadableStream) {
      return initialRes
    }

    // Make sure the initial request is cancelled to avoid leaking resources
    // (NodeJS 👀): https://undici.nodejs.org/#/?id=garbage-collection
    if (!initialRes.bodyUsed) {
      await initialRes.body?.cancel()
    }

    // Finally, retry the request with the new access token
    headers.set('authorization', `Bearer ${newSessionData.accessJwt}`)
    return fetch(fetchUrl(newSessionData, path), { ...init, headers })
  }

  /**
   * Refreshes the session by obtaining new access and refresh tokens.
   *
   * This method is automatically called by {@link fetchHandler} when the access
   * token expires. You can also call it manually to proactively refresh tokens.
   *
   * On success, the {@link PasswordSessionOptions.onUpdated} callback is invoked
   * with the new session data. On expected failures (invalid session), the
   * {@link PasswordSessionOptions.onDeleted} callback is invoked. On unexpected
   * failures (network issues), the {@link PasswordSessionOptions.onUpdateFailure}
   * callback is invoked and the existing session data is preserved.
   *
   * @returns The refreshed session data
   * @throws {RefreshFailure} If the session is no longer valid (triggers onDeleted)
   */
  async refresh(): Promise<SessionData> {
    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const response = await xrpcSafe(
        this.#serviceAgent,
        com.atproto.server.refreshSession.main,
        { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } },
      )

      if (!response.success && response.matchesSchema()) {
        // Expected errors that indicate the session is no longer valid
        await this.options.onDeleted?.call(this, sessionData)

        // Update the session promise to a rejected state
        this.#sessionData = null
        throw response
      }

      if (!response.success) {
        response.error
        if (response.matchesSchema()) {
          response.error
        }
        // We failed to refresh the token, assume the session might still be
        // valid by returning the existing session.
        await this.options.onUpdateFailure?.call(this, sessionData, response)

        return sessionData
      }

      const data = response.body

      // Historically, refreshSession did not return all the fields from
      // getSession. In particular, emailConfirmed and didDoc were missing.
      // Similarly, some servers might not return the didDoc in refreshSession.
      // We fetch them via getSession if missing, allowing to ensure that we are
      // always talking with the right PDS.
      if (data.emailConfirmed == null || data.didDoc == null) {
        const extraData = await xrpcSafe(
          this.#serviceAgent,
          com.atproto.server.getSession.main,
          { headers: { Authorization: `Bearer ${data.accessJwt}` } },
        )
        if (extraData.success && extraData.body.did === data.did) {
          Object.assign(data, extraData.body)
        }
      }

      const newSession: SessionData = {
        ...data,
        service: sessionData.service,
      }

      await this.options.onUpdated?.call(this, newSession)

      return (this.#sessionData = newSession)
    })

    return this.#sessionPromise
  }

  /**
   * Logs out by deleting the session on the server.
   *
   * This method invalidates both the access and refresh tokens on the server,
   * preventing any further use of this session. After successful logout, the
   * session is marked as destroyed and the {@link PasswordSessionOptions.onDeleted}
   * callback is invoked.
   *
   * If the logout request fails due to network issues or server unavailability,
   * the {@link PasswordSessionOptions.onDeleteFailure} callback is invoked and
   * the session remains active locally. In this case, you should retry the
   * logout later to ensure the session is properly invalidated on the server.
   *
   * @throws {DeleteFailure} If the logout request fails due to unexpected errors
   */
  async logout(): Promise<void> {
    let reason: DeleteFailure | null = null

    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const result = await xrpcSafe(
        this.#serviceAgent,
        com.atproto.server.deleteSession.main,
        { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } },
      )

      if (result.success || result.matchesSchema()) {
        await this.options.onDeleted?.call(this, sessionData)

        // Update the session promise to a rejected state
        this.#sessionData = null
        throw new Error('Logged out')
      } else {
        // Capture the reason for the failure to re-throw in the outer promise
        reason = result

        // An unknown/unexpected error occurred (network, server down, etc)
        await this.options.onDeleteFailure?.call(this, sessionData, result)

        // Keep the session in an active state
        return sessionData
      }
    })

    return this.#sessionPromise.then(
      (_session) => {
        // If the promise above resolved, then logout failed. Re-throw the
        // reason captured earlier.
        throw reason!
      },
      (_err) => {
        // Successful logout
      },
    )
  }

  /**
   * Creates a new account and returns an authenticated session.
   *
   * This static method registers a new account on the specified service and
   * automatically creates an authenticated session for it.
   *
   * @param body - Account creation parameters (handle, email, password, etc.)
   * @param options - Session options including the service URL
   * @returns A new PasswordSession for the created account
   * @throws If account creation fails (e.g., handle taken, invalid invite code)
   *
   * @example
   * ```ts
   * const session = await PasswordSession.createAccount(
   *   {
   *     handle: 'alice.bsky.social',
   *     email: 'alice@example.com',
   *     password: 'secure-password',
   *   },
   *   {
   *     service: 'https://bsky.social',
   *     onUpdated: (data) => saveToStorage(data),
   *   }
   * )
   * ```
   */
  static async createAccount(
    body: com.atproto.server.createAccount.$InputBody,
    {
      service,
      headers,
      ...options
    }: PasswordSessionOptions & {
      headers?: HeadersInit
      service: string | URL
    },
  ): Promise<PasswordSession> {
    const response = await xrpc(
      buildAgent({ service, headers, fetch: options.fetch }),
      com.atproto.server.createAccount.main,
      { body },
    )

    const data: SessionData = {
      ...response.body,
      service: String(service),
    }

    const agent = new PasswordSession(data, options)
    await options.onUpdated?.call(agent, data)
    return agent
  }

  /**
   * Creates a new authenticated session using password credentials.
   *
   * This static method authenticates with the specified service and returns
   * a new PasswordSession instance that can be used for authenticated requests.
   *
   * **Security Warning:** It is strongly recommended to use app passwords instead
   * of main account credentials. App passwords can be created in your account
   * settings and provide limited access that can be revoked independently. For
   * browser-based applications, use OAuth-based authentication instead.
   *
   * @param options - Login options including service URL, identifier, and password
   * @param options.service - The AT Protocol service URL (e.g., 'https://bsky.social')
   * @param options.identifier - The user's handle or DID
   * @param options.password - The user's password or app password
   * @param options.allowTakendown - If true, allow login to takendown accounts
   * @param options.authFactorToken - 2FA token if required by the server
   * @returns A new authenticated PasswordSession
   * @throws {LexAuthFactorError} If the server requires a 2FA token
   * @throws If authentication fails (invalid credentials, etc.)
   *
   * @example Basic login with app password
   * ```ts
   * const session = await PasswordSession.login({
   *   service: 'https://bsky.social',
   *   identifier: 'alice.bsky.social',
   *   password: 'xxxx-xxxx-xxxx-xxxx', // App password
   *   onUpdated: (data) => saveToStorage(data),
   * })
   * ```
   *
   * @example Handling 2FA requirement
   * ```ts
   * try {
   *   const session = await PasswordSession.login({
   *     service: 'https://bsky.social',
   *     identifier: 'alice.bsky.social',
   *     password: 'xxxx-xxxx-xxxx-xxxx',
   *   })
   * } catch (err) {
   *   if (err instanceof LexAuthFactorError) {
   *     const token = await promptUser('Enter 2FA code:')
   *     const session = await PasswordSession.login({
   *       service: 'https://bsky.social',
   *       identifier: 'alice.bsky.social',
   *       password: 'xxxx-xxxx-xxxx-xxxx',
   *       authFactorToken: token,
   *     })
   *   }
   * }
   * ```
   */
  static async login({
    service,
    identifier,
    password,
    allowTakendown,
    authFactorToken,
    ...options
  }: PasswordSessionOptions & {
    service: string | URL
    identifier: string
    password: string
    allowTakendown?: boolean
    authFactorToken?: string
  }): Promise<PasswordSession> {
    const xrpcAgent = buildAgent({
      service,
      fetch: options.fetch,
    })

    const response = await xrpcSafe(
      xrpcAgent,
      com.atproto.server.createSession.main,
      { body: { identifier, password, allowTakendown, authFactorToken } },
    )

    if (!response.success) {
      if (response.error === 'AuthFactorTokenRequired') {
        throw new LexAuthFactorError(response)
      }
      throw response.reason
    }

    const data: SessionData = {
      ...response.body,
      service: String(service),
    }

    const agent = new PasswordSession(data, options)
    await options.onUpdated?.call(agent, data)
    return agent
  }

  /**
   * Resume an existing session, ensuring it is still valid by refreshing it.
   * Any error thrown here indicates that the session is definitely no longer
   * valid. Network errors will be propagated through the
   * {@link PasswordSessionOptions.onUpdateFailure} hook, and not re-thrown
   * here. This means that a resolved promise does not necessarily indicate a
   * valid session, only that it's refresh did not definitively fail.
   *
   * This is the same as calling {@link PasswordSession.refresh} after
   * constructing the {@link PasswordSession} manually.
   *
   * @throws If, and only if, the session is definitely no longer valid.
   */
  static async resume(
    data: SessionData,
    options: PasswordSessionOptions,
  ): Promise<PasswordSession> {
    const agent = new PasswordSession(data, options)
    await agent.refresh()
    return agent
  }

  /**
   * Delete a session without having to {@link resume resume()} it first, or
   * provide hooks.
   *
   * @throws In case of unexpected error (network issue, server down, etc)
   * meaning that the session may still be valid.
   */
  static async delete(
    data: SessionData,
    options?: PasswordSessionOptions,
  ): Promise<void> {
    const agent = new PasswordSession(data, options)
    await agent.logout()
  }
}

function fetchUrl(sessionData: SessionData, path: string): URL {
  const pdsUrl = extractPdsUrl(sessionData.didDoc)
  return new URL(path, pdsUrl ?? sessionData.service)
}
