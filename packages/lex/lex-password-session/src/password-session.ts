import {
  Agent,
  XrpcError,
  XrpcFailure,
  buildAgent,
  xrpcSafe,
} from '@atproto/lex-client'
import { LexAuthFactorError } from './error.js'
import { com } from './lexicons/index.js'
import { extractPdsUrl, extractXrpcErrorCode, noop } from './util.js'

export type RefreshFailure = XrpcFailure<
  typeof com.atproto.server.refreshSession.main
>

export type DeleteFailure = XrpcFailure<
  typeof com.atproto.server.deleteSession.main
>

export type SessionData = com.atproto.server.createSession.OutputBody & {
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
  onUpdated: (this: PasswordSession, data: SessionData) => void | Promise<void>

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
  onDeleted: (this: PasswordSession, data: SessionData) => void | Promise<void>

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
    protected readonly options: PasswordSessionOptions,
  ) {
    this.#serviceAgent = buildAgent({
      service: sessionData.service,
      fetch: options.fetch,
    })

    this.#sessionData = sessionData
    this.#sessionPromise = Promise.resolve(this.#sessionData)
  }

  get did() {
    return this.session.did
  }

  get handle() {
    return this.session.handle
  }

  get session() {
    if (this.#sessionData) return this.#sessionData
    throw new XrpcError('AuthenticationRequired', 'Logged out')
  }

  get destroyed(): boolean {
    return this.#sessionData === null
  }

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

  async refresh(): Promise<SessionData> {
    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const response = await xrpcSafe(
        this.#serviceAgent,
        com.atproto.server.refreshSession.main,
        { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } },
      )

      if (!response.success && response.matchesSchema()) {
        // Expected errors that indicate the session is no longer valid
        await this.options.onDeleted.call(this, sessionData)

        // Update the session promise to a rejected state
        this.#sessionData = null
        throw response
      }

      if (!response.success) {
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

      await this.options.onUpdated.call(this, newSession)

      return (this.#sessionData = newSession)
    })

    return this.#sessionPromise
  }

  async logout(): Promise<void> {
    let reason: DeleteFailure | null = null

    this.#sessionPromise = this.#sessionPromise.then(async (sessionData) => {
      const result = await xrpcSafe(
        this.#serviceAgent,
        com.atproto.server.deleteSession.main,
        { headers: { Authorization: `Bearer ${sessionData.refreshJwt}` } },
      )

      if (result.success || result.matchesSchema()) {
        await this.options.onDeleted.call(this, sessionData)

        // Update the session promise to a rejected state
        this.#sessionData = null
        throw new XrpcError('AuthenticationRequired', 'Logged out')
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
   * @note It is **not** recommended to use {@link PasswordSession} with main
   * account credentials. Instead, it is strongly advised to use OAuth based
   * authentication for main username/password credentials and use
   * {@link PasswordSession} with an app-password, for bots, scripts, or similar
   * use-cases.
   *
   * @throws If unable to create a session. In particular, if the server
   * requires a 2FA token, a {@link XrpcResponseError} with the
   * `AuthFactorTokenRequired` error code will be thrown.
   *
   *
   * @example Handling 2FA errors
   *
   * ```ts
   * try {
   *   const session = await PasswordSession.create({
   *     service: 'https://example.com',
   *     identifier: 'alice',
   *     password: 'correct horse battery staple',
   *   })
   * } catch (err) {
   *   if (err instanceof XrpcResponseError && err.error === 'AuthFactorTokenRequired') {
   *     // Prompt user for 2FA token and re-attempt session creation
   *   }
   * }
   * ```
   */
  static async create({
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
    await options.onUpdated.call(agent, data)
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
    options?: Partial<PasswordSessionOptions>,
  ): Promise<void> {
    const agent = new PasswordSession(data, {
      ...options,
      onUpdated: options?.onUpdated ?? noop,
      onDeleted: options?.onDeleted ?? noop,
    })
    await agent.logout()
  }
}

function fetchUrl(sessionData: SessionData, path: string): URL {
  const pdsUrl = extractPdsUrl(sessionData.didDoc)
  return new URL(path, pdsUrl ?? sessionData.service)
}
