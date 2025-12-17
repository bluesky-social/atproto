import {
  Agent,
  XrpcError,
  XrpcFailure,
  buildAgent,
  xrpc,
  xrpcSafe,
} from '@atproto/lex-client'
import { DatetimeString, LexMap, l } from '@atproto/lex-schema'
import { com } from './lexicons.js'
import { ifArray, ifString, peekJson } from './util.js'

export type Session = {
  data: com.atproto.server.createSession.OutputBody
  refreshedAt: DatetimeString
  pdsUrl: string | null
  service: string
}

export type PasswordAuthAgentOptions = {
  fetch?: typeof globalThis.fetch
  hooks?: {
    onRefreshed?: (
      this: PasswordAgent,
      session: Session,
    ) => void | Promise<void>
    onRefreshFailure?: (
      this: PasswordAgent,
      session: Session,
      err: XrpcFailure<typeof com.atproto.server.refreshSession.main>,
    ) => void | Promise<void>
    onDeleted?: (this: PasswordAgent, session: Session) => void | Promise<void>
    onDeleteFailure?: (
      this: PasswordAgent,
      session: Session,
      err: XrpcFailure<typeof com.atproto.server.deleteSession.main>,
    ) => void | Promise<void>
  }
}

export class PasswordAgent implements Agent {
  #agent: Agent
  #session: null | Session
  #sessionPromise: Promise<Session>

  protected constructor(
    session: Session,
    protected readonly options: PasswordAuthAgentOptions = {},
  ) {
    this.#agent = buildAgent({
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
    throw new XrpcError('AuthenticationRequired', 'Logged out')
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

    const isExpiredToken = await isExpiredTokenResponse(initialRes)
    if (!isExpiredToken) {
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
    await initialRes.body?.cancel()

    headers.set('authorization', `Bearer ${newSession.data.accessJwt}`)
    return fetch(fetchUrl(newSession, path), { ...init, headers })
  }

  async refresh(): Promise<Session> {
    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const response = await xrpcSafe(
        this.#agent,
        com.atproto.server.refreshSession,
        { headers: { Authorization: `Bearer ${session.data.refreshJwt}` } },
      )

      if (!response.success) {
        if (
          response.error === 'AccountTakedown' ||
          response.error === 'InvalidToken' ||
          response.error === 'ExpiredToken'
        ) {
          await this.options.hooks?.onDeleted?.call(this, session)
          throw response
        }

        // We failed to refresh the token, but the session might still be valid.
        await this.options.hooks?.onRefreshFailure?.call(
          this,
          session,
          response,
        )

        return session
      }

      const newSession: Session = {
        data: response.body,
        service: session.service,
        pdsUrl: extractPdsUrl(response.body.didDoc),
        refreshedAt: new Date().toISOString(),
      }

      await this.options.hooks?.onRefreshed?.call(this, newSession)

      this.#session = newSession

      return newSession
    })

    return this.#sessionPromise
  }

  async logout(): Promise<void> {
    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const result = await xrpcSafe(
        this.#agent,
        com.atproto.server.deleteSession,
        { headers: { Authorization: `Bearer ${session.data.refreshJwt}` } },
      )

      if (!result.success) {
        if (
          result.error === 'InvalidToken' ||
          result.error === 'ExpiredToken'
        ) {
          // Already deleted, all good
        } else {
          await this.options.hooks?.onDeleteFailure?.call(this, session, result)
          // The server might be down or network error occurred, we are not
          // actually logged out.
          return session
        }
      }

      await this.options.hooks?.onDeleted?.call(this, session)

      throw new XrpcError('AuthenticationRequired', 'Logged out')
    })

    return this.#sessionPromise.then(
      (_session) => {
        throw new XrpcError('AuthenticationRequired', 'Logout failed')
      },
      (_err) => {
        // Successful logout, mark this as "destroyed"
        this.#session = null
      },
    )
  }

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
  }): Promise<PasswordAgent> {
    const agent = buildAgent({
      service,
      fetch: options.fetch,
    })

    const response = await xrpc(agent, com.atproto.server.createSession, {
      body: {
        identifier,
        password,
        authFactorToken,
      },
    })

    const session: Session = {
      data: response.body,
      pdsUrl: extractPdsUrl(response.body.didDoc),
      service: String(service),
      refreshedAt: new Date().toISOString(),
    }

    return new PasswordAgent(session, options)
  }

  /**
   * Delete a session without having to {@link resume}() first.
   */
  static async delete(
    session: Session,
    options?: PasswordAuthAgentOptions,
  ): Promise<void> {
    const agent = buildAgent({
      service: session.service,
      fetch: options?.fetch,
    })

    const result = await xrpcSafe(agent, com.atproto.server.deleteSession, {
      headers: { Authorization: `Bearer ${session.data.refreshJwt}` },
    })

    if (
      !result.success &&
      result.error !== 'AccountTakedown' &&
      result.error !== 'InvalidToken' &&
      result.error !== 'ExpiredToken'
    ) {
      throw result
    }
  }
}

const expiredTokenBodySchema = l.object({
  error: l.literal('ExpiredToken'),
})

async function isExpiredTokenResponse(response: Response): Promise<boolean> {
  if (response.status !== 400) return false
  try {
    const json = await peekJson(response, 1024)
    return expiredTokenBodySchema.matches(json)
  } catch {
    return false
  }
}

function fetchUrl(session: Session, path: string): URL {
  return new URL(path, session.pdsUrl ?? session.service)
}

function extractPdsUrl(didDoc?: LexMap): string | null {
  const pdsService = ifArray(didDoc?.service)?.find((service) =>
    ifString((service as any)?.id)?.endsWith('#atproto_pds'),
  )
  const pdsEndpoint = ifString((pdsService as any)?.serviceEndpoint)
  return pdsEndpoint && URL.canParse(pdsEndpoint) ? pdsEndpoint : null
}
