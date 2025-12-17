import { Agent, Client } from '@atproto/lex-client'
import { DatetimeString, LexMap, l } from '@atproto/lex-schema'
import { com } from './lexicons.js'
import { ifArray, ifString, peekJson } from './util.js'

// @ts-expect-error poly fill
Symbol.asyncDispose ??= Symbol.for('Symbol.asyncDispose')

export type Session = com.atproto.server.createSession.OutputBody & {
  refreshedAt: DatetimeString
  service: string
}

export type PasswordAuthAgentOptions = {
  fetch?: typeof globalThis.fetch
  hooks?: {
    onRefreshed?: (session: Session) => void | Promise<void>
    onRefreshFailure?: (session: Session, err: unknown) => void | Promise<void>
    onDeleted?: (session: Session) => void | Promise<void>
    onDeleteFailure?: (session: Session, err: unknown) => void | Promise<void>
  }
}

export class PasswordAgent implements Agent {
  #client: Client
  #session: null | Session
  #sessionPromise: Promise<Session>

  protected constructor(
    session: Session,
    protected readonly options: PasswordAuthAgentOptions = {},
  ) {
    this.#client = new Client({
      service: session.service,
      fetch: options.fetch,
    })
    this.#session = session
    this.#sessionPromise = Promise.resolve(session)
  }

  get did() {
    return this.session.did
  }

  get session(): Session {
    if (!this.#session) {
      throw new Error('No active session')
    }
    return this.#session
  }

  async fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (headers.has('authorization')) {
      throw new TypeError("Unexpected 'authorization' header set")
    }

    const sessionPromise = this.#sessionPromise
    const session = await sessionPromise

    const fetch = this.options.fetch ?? globalThis.fetch

    headers.set('authorization', `Bearer ${session.accessJwt}`)
    const initialRes = await fetch(pdsUrl(session, path), { ...init, headers })

    // If we don't have a refresh token, there is no point in even checking
    // for a 401, as we can't refresh.
    if (!session.refreshJwt) {
      return initialRes
    }

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

    // Token was not actually refreshed, avoid retrying the request.
    if (newSession.accessJwt === session.accessJwt) {
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

    headers.set('authorization', `Bearer ${newSession.accessJwt}`)
    return fetch(pdsUrl(newSession, path), { ...init, headers })
  }

  async refresh(): Promise<Session> {
    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const response = await this.#client.xrpcSafe(
        com.atproto.server.refreshSession,
        {
          headers: { Authorization: `Bearer ${session.refreshJwt}` },
        },
      )

      if (!response.success) {
        if (
          response.error === 'InvalidToken' ||
          response.error === 'ExpiredToken'
        ) {
          await this.options.hooks?.onDeleted?.call(null, session)
          throw response
        }

        // We failed to refresh the token, but the session might still be valid.
        await this.options.hooks?.onRefreshFailure?.call(
          null,
          session,
          response,
        )

        return session
      }

      const newSession: Session = {
        ...response.body,
        service: session.service,
        refreshedAt: new Date().toISOString(),
      }

      await this.options.hooks?.onRefreshed?.call(null, newSession)

      this.#session = newSession

      return newSession
    })

    return this.#sessionPromise
  }

  async logout(): Promise<void> {
    this.#sessionPromise = this.#sessionPromise.then(async (session) => {
      const result = await this.#client.xrpcSafe(
        com.atproto.server.deleteSession,
        {
          headers: { Authorization: `Bearer ${session.refreshJwt}` },
        },
      )

      if (!result.success) {
        if (
          result.error === 'InvalidToken' ||
          result.error === 'ExpiredToken'
        ) {
          // Already deleted, all good
        } else {
          await this.options.hooks?.onDeleteFailure?.call(null, session, result)
          // The server might be down or network error occurred, we are not
          // actually logged out.
          return session
        }
      }

      await this.options.hooks?.onDeleted?.call(null, session)

      throw new Error('Logged out')
    })

    return this.#sessionPromise.then(
      (_session) => {
        throw new Error('Logout failed')
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
    const client = new Client({ fetch: options.fetch, service })

    const response = await client.xrpc(com.atproto.server.createSession, {
      body: {
        identifier,
        password,
        authFactorToken,
      },
    })

    const session: Session = {
      ...response.body,
      service: String(service),
      refreshedAt: new Date().toISOString(),
    }

    await options?.hooks?.onRefreshed?.call(null, session)

    return new PasswordAgent(session, options)
  }

  /**
   * Delete a session without having to {@link resume}() first.
   */
  static async delete(
    session: Session,
    options?: PasswordAuthAgentOptions,
  ): Promise<void> {
    const client = new Client({
      service: session.service,
      fetch: options?.fetch,
    })

    const result = await client.xrpcSafe(com.atproto.server.deleteSession, {
      headers: { Authorization: `Bearer ${session.refreshJwt}` },
    })

    if (
      !result.success &&
      result.error !== 'InvalidToken' &&
      result.error !== 'ExpiredToken'
    ) {
      await options?.hooks?.onDeleteFailure?.call(null, session, result)
      throw result
    }

    await options?.hooks?.onDeleted?.call(null, session)
  }
}

const expiredTokenBodySchema = l.object({
  error: l.literal('ExpiredToken'),
})

async function isExpiredTokenResponse(response: Response): Promise<boolean> {
  if (response.status !== 400) return false
  try {
    const json = await peekJson(response, 10 * 1024)
    return expiredTokenBodySchema.matches(json)
  } catch {
    return false
  }
}

function pdsUrl(session: Session, path: string): URL {
  if (!session.didDoc) {
    return new URL(path, session.service)
  }

  // If the authentication service returned as DID Document, we must use
  // the PDS service endpoint from there. If that did document did not include
  // a PDS service endpoint, we cannot proceed.

  const pds = extractPdsUrl(session.didDoc)
  if (pds) {
    return new URL(path, pds)
  }

  // @TODO Make this error simpler to handle for the caller (e.g. a specific
  // error class) so it can better surface the issue to the user (error with
  // the user's identity on the network)
  throw new TypeError('PDS service endpoint not found in DID Document')
}

function extractPdsUrl(didDoc?: LexMap): string | null {
  const pdsService = ifArray(didDoc?.service)?.find((service) =>
    ifString((service as any)?.id)?.endsWith('#atproto_pds'),
  )
  const pdsEndpoint = ifString((pdsService as any)?.serviceEndpoint)
  return pdsEndpoint && URL.canParse(pdsEndpoint) ? pdsEndpoint : null
}
