import {
  Agent,
  Client,
  DidString,
  XrpcError,
  XrpcResponseError,
} from '@atproto/lex-client'
import { HandleString, LexMap } from '@atproto/lex-schema'
import { ifArray, ifString, peekJson } from './util.js'
import { com } from '#lexicons'

// @ts-expect-error poly fill
Symbol.asyncDispose ??= Symbol.for('Symbol.asyncDispose')

export type Session = {
  did: DidString
  service: string
  refreshJwt: string
  accessJwt: string

  didDoc?: LexMap
  email?: string
  emailConfirmed?: boolean
  emailAuthFactor?: boolean
  active: boolean
  status?: string
  handle: HandleString
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

export class PasswordAuthAgent implements Agent, AsyncDisposable {
  #did: null | DidString
  #session: Promise<Session>
  #options: PasswordAuthAgentOptions

  declare client: Client

  protected constructor(
    session: Session,
    options: PasswordAuthAgentOptions = {},
  ) {
    this.#did = session.did
    this.#session = Promise.resolve(session)
    this.#options = options
  }

  get did() {
    const did = this.#did
    if (did) return did
    throw new Error('Logged out')
  }

  async fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (headers.has('authorization')) {
      throw new TypeError("Unexpected 'authorization' header set")
    }

    const sessionPromise = this.#session
    const session = await sessionPromise

    const fetch = this.#options.fetch ?? globalThis.fetch

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
      this.#session === sessionPromise ? this.refreshSession() : this.#session

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

  async refreshSession(): Promise<Session> {
    this.#session = this.#session.then(async (session) => {
      try {
        const res = await this.client.xrpc(com.atproto.server.refreshSession, {
          headers: { Authorization: `Bearer ${session.refreshJwt}` },
        })

        const newSession: Session = {
          ...session,
          didDoc: res.body.didDoc,
          active: res.body.active ?? session.active,
          status: res.body.status,
          handle: res.body.handle,
          accessJwt: res.body.accessJwt,
          refreshJwt: res.body.refreshJwt,
        }

        await this.#options.hooks?.onRefreshed?.call(null, newSession)

        return newSession
      } catch (err) {
        if (isTokenError(err)) {
          await this.#options.hooks?.onDeleted?.call(null, session)
          throw err
        }

        // We failed to refresh the token, but the session might still be valid.
        await this.#options.hooks?.onRefreshFailure?.call(null, session, err)

        return session
      }
    })

    return this.#session
  }

  async logout(): Promise<void> {
    this.#session = this.#session.then(async (session) => {
      try {
        await this.client.xrpc(com.atproto.server.deleteSession, {
          headers: { Authorization: `Bearer ${session.refreshJwt}` },
        })
      } catch (err) {
        if (err instanceof XrpcResponseError && err.status === 401) {
          // Already deleted, all good
        } else {
          await this.#options.hooks?.onDeleteFailure?.call(null, session, err)
          // The server might be down or network error occurred, we are not
          // actually logged out.
          return session
        }
      }

      await this.#options.hooks?.onDeleted?.call(null, session)

      throw new Error('Logged out')
    })

    return this.#session.then(
      (_session) => {
        throw new Error('Logout failed')
      },
      (_err) => {
        // All good
      },
    )
  }

  static async resume(
    _session: Session,
    _options?: PasswordAuthAgentOptions,
  ): Promise<PasswordAuthAgent> {
    // @TODO
    throw new Error('Not implemented')
  }

  static async login(
    _service: string | URL,
    _identifier: string,
    _password: string,
    _options?: PasswordAuthAgentOptions,
  ): Promise<PasswordAuthAgent> {
    // @TODO
    throw new Error('Not implemented')
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

    try {
      await client.xrpc(com.atproto.server.deleteSession, {
        headers: { Authorization: `Bearer ${session.refreshJwt}` },
      })
    } catch (err) {
      if (!isTokenError(err)) {
        await options?.hooks?.onDeleteFailure?.call(null, session, err)
        throw err
      }
    }

    await options?.hooks?.onDeleted?.call(null, session)
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.logout()
  }
}

function isTokenError(
  err: unknown,
): err is XrpcError<'ExpiredToken' | 'InvalidToken'> {
  if (err instanceof XrpcError) {
    return err.name === 'ExpiredToken' || err.name === 'InvalidToken'
  }
  return false
}

async function isExpiredTokenResponse(response: Response): Promise<boolean> {
  if (response.status !== 400) return false
  try {
    const json = await peekJson(response, 10 * 1024)
    return (
      json != null &&
      typeof json === 'object' &&
      'error' in json &&
      json.error === 'ExpiredToken'
    )
  } catch (err) {
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
