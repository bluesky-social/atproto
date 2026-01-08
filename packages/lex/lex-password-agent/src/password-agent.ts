import {
  Agent,
  LexRpcError,
  LexRpcFailure,
  LexRpcResponseError,
  buildAgent,
  xrpcSafe,
} from '@atproto/lex-client'
import { DatetimeString, ResultSuccess, success } from '@atproto/lex-schema'
import { com } from './lexicons/index.js'
import { extractLexRpcErrorCode, extractPdsUrl } from './util.js'

export type Session = {
  data: com.atproto.server.createSession.OutputBody
  refreshedAt: DatetimeString
  pdsUrl: string | null
  service: string
}

export type PasswordAuthAgentHooks = {
  /**
   * Called whenever the session is successfully refreshed, and new credentials
   * have been obtained. This function should be used to persist the updated
   * session information. It should run quickly as any requests made while this
   * callback is running will be blocked until it completes.
   *
   * If this callback returns a promise, this function will never be called
   * again until the promise resolves.
   *
   * @note the provided callback should never throw
   */
  onRefreshed?: (this: PasswordAgent, session: Session) => void | Promise<void>

  /**
   * Called whenever a session refresh fails due to an expected error, such as a
   * network issue or server unavailability. This function can be used to log
   * the error or notify the user, but should not assume that the session is
   * invalid.
   *
   * @note the provided callback should never throw
   */
  onRefreshFailure?: (
    this: PasswordAgent,
    session: Session,
    err: LexRpcFailure<typeof com.atproto.server.refreshSession.main>,
  ) => void | Promise<void>

  /**
   * Called whenever the session is deleted, either due to an explicit logout
   * or because the refresh operation indicated that the session is no longer
   * valid. This function should be used to clean up any persisted session
   * information and update the application state accordingly.
   *
   * @note the provided callback should never throw
   */
  onDeleted?: (this: PasswordAgent, session: Session) => void | Promise<void>

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
   * @note the provided callback should never throw
   */
  onDeleteFailure?: (
    this: PasswordAgent,
    session: Session,
    err: LexRpcFailure<typeof com.atproto.server.deleteSession.main>,
  ) => void | Promise<void>
}

export type PasswordAuthAgentOptions = {
  fetch?: typeof globalThis.fetch
  hooks?: PasswordAuthAgentHooks
}

export class PasswordAgent implements Agent {
  /** Agent used for session management */
  #sessionAgent: Agent
  #session: null | Session
  #sessionPromise: Promise<Session>

  protected constructor(
    session: Session,
    protected readonly options: PasswordAuthAgentOptions = {},
  ) {
    this.#sessionAgent = buildAgent({
      service: session.service,
      fetch: options.fetch,
    })
    this.#session = structuredClone(session)
    this.#sessionPromise = Promise.resolve(this.#session)
  }

  get did() {
    return this.session.data.did
  }

  get session(): Session {
    if (this.#session) return this.#session
    throw new LexRpcError('AuthenticationRequired', 'Logged out')
  }

  get destroyed(): boolean {
    return this.#session === null
  }

  async fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (headers.has('authorization')) {
      throw new TypeError("Unexpected 'authorization' header set")
    }

    const sessionPromise = this.#sessionPromise
    const session = await sessionPromise

    const fetch = this.options.fetch ?? globalThis.fetch

    headers.set('authorization', `Bearer ${session.data.accessJwt}`)
    const initialRes = await fetch(fetchUrl(session, path), {
      ...init,
      headers,
    })

    const refreshNeeded =
      initialRes.status === 401 ||
      (initialRes.status === 400 &&
        (await extractLexRpcErrorCode(initialRes)) === 'ExpiredToken')

    if (!refreshNeeded) {
      return initialRes
    }

    // Refresh session (unless it was already refreshed in the meantime)
    const newSessionPromise =
      this.#sessionPromise === sessionPromise
        ? this.refresh()
        : this.#sessionPromise

    // Error should have been propagated through hooks
    const newSession = await newSessionPromise.catch((_err) => null)
    if (!newSession) {
      return initialRes
    }

    // refresh silently failed, no point in retrying.
    if (newSession.data.accessJwt === session.data.accessJwt) {
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
    headers.set('authorization', `Bearer ${newSession.data.accessJwt}`)
    return fetch(fetchUrl(newSession, path), { ...init, headers })
  }

  async refresh(): Promise<Session> {
    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const response = await xrpcSafe(
        this.#sessionAgent,
        com.atproto.server.refreshSession.main,
        { headers: { Authorization: `Bearer ${session.data.refreshJwt}` } },
      )

      if (!response.success && response.matchesSchema()) {
        // Expected errors that indicate the session is no longer valid
        await this.options.hooks?.onDeleted?.call(this, session)

        throw response
      }

      if (!response.success) {
        // We failed to refresh the token, assume the session might still be
        // valid by returning the existing session.
        await this.options.hooks?.onRefreshFailure?.call(
          this,
          session,
          response,
        )

        return session
      }

      const data = response.body

      // Historically, refreshSession did not return all the fields from
      // getSession. In particular, emailConfirmed and didDoc were missing.
      // Similarly, some servers might not return the didDoc in refreshSession.
      // We fetch them via getSession if missing, allowing to ensure that we are
      // always talking with the right PDS.
      if (data.emailConfirmed == null || data.didDoc == null) {
        const extraData = await xrpcSafe(
          this.#sessionAgent,
          com.atproto.server.getSession.main,
          { headers: { Authorization: `Bearer ${data.accessJwt}` } },
        )
        if (extraData.success && extraData.body.did === data.did) {
          Object.assign(data, extraData.body)
        }
      }

      const newSession: Session = {
        data: { ...session.data, ...data },
        service: session.service,
        pdsUrl: extractPdsUrl(data.didDoc),
        refreshedAt: new Date().toISOString(),
      }

      await this.options.hooks?.onRefreshed?.call(this, newSession)

      return (this.#session = newSession)
    })

    return this.#sessionPromise
  }

  async logout(): Promise<void> {
    let reason: LexRpcFailure<
      typeof com.atproto.server.deleteSession.main
    > | null = null

    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const result = await xrpcSafe(
        this.#sessionAgent,
        com.atproto.server.deleteSession.main,
        { headers: { Authorization: `Bearer ${session.data.refreshJwt}` } },
      )

      if (result.success || result.matchesSchema()) {
        await this.options.hooks?.onDeleted?.call(this, session)

        // Update the session promise to a rejected state
        this.#session = null
        throw new LexRpcError('AuthenticationRequired', 'Logged out')
      } else {
        // Capture the reason for the failure to re-throw in the outer promise
        reason = result

        // An unknown/unexpected error occurred (network, server down, etc)
        await this.options.hooks?.onDeleteFailure?.call(this, session, result)

        // Keep the session in an active state
        return session
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
   * @throws In case of unexpected error
   */
  static async login({
    service,
    identifier,
    password,
    authFactorToken,
    ...options
  }: PasswordAuthAgentOptions & {
    service: string | URL
    identifier: string
    password: string
    authFactorToken?: string
  }): Promise<
    | ResultSuccess<PasswordAgent>
    | LexRpcResponseError<typeof com.atproto.server.createSession.main>
  > {
    const xrpcAgent = buildAgent({
      service,
      fetch: options.fetch,
    })

    const response = await xrpcSafe(
      xrpcAgent,
      com.atproto.server.createSession.main,
      { body: { identifier, password, authFactorToken } },
    )

    if (!response.success) {
      if (response.matchesSchema()) return response
      throw response
    }

    const session: Session = {
      data: response.body,
      pdsUrl: extractPdsUrl(response.body.didDoc),
      service: String(service),
      refreshedAt: new Date().toISOString(),
    }

    const agent = new PasswordAgent(session, options)
    return success(agent)
  }

  static async resume(
    session: Session,
    options?: PasswordAuthAgentOptions,
  ): Promise<PasswordAgent> {
    const agent = new PasswordAgent(session, options)
    await agent.refresh()
    return agent
  }

  /**
   * Delete a session without having to {@link resume}() first.
   *
   * @throws In case of unexpected error
   */
  static async delete(
    session: Session,
    options?: PasswordAuthAgentOptions,
  ): Promise<void> {
    const agent = buildAgent({
      service: session.service,
      fetch: options?.fetch,
    })

    const result = await xrpcSafe(
      agent,
      com.atproto.server.deleteSession.main,
      {
        headers: { Authorization: `Bearer ${session.data.refreshJwt}` },
      },
    )

    if (
      !result.success &&
      result.error !== 'AccountTakedown' &&
      result.error !== 'InvalidToken' &&
      result.error !== 'ExpiredToken' // Legacy implementations support
    ) {
      throw result
    }
  }
}

function fetchUrl(session: Session, path: string): URL {
  return new URL(path, session.pdsUrl ?? session.service)
}
