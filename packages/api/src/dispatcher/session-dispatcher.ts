import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import {
  ErrorResponseBody,
  ResponseType,
  XRPCError,
  errorResponseBody,
} from '@atproto/xrpc'
import {
  AtpClient,
  ComAtprotoServerCreateAccount,
  ComAtprotoServerCreateSession,
  ComAtprotoServerGetSession,
} from '../client'
import {
  AtpAgentLoginOpts,
  AtpPersistSessionHandler,
  AtpSessionData,
} from '../types'
import { AtpDispatcher } from './atp-dispatcher'

const ReadableStream = globalThis.ReadableStream as
  | typeof globalThis.ReadableStream
  | undefined

export type Fetch = (this: void, request: Request) => Promise<Response>
export interface SessionDispatcherOptions {
  service: string | URL
  persistSession?: AtpPersistSessionHandler
  fetch?: Fetch
}

/**
 * An {@link XrpcDispatcher} that uses legacy "com.atproto.server" endpoints to
 * manage sessions and route XRPC requests.
 */
export class SessionDispatcher extends AtpDispatcher {
  public serviceUrl: URL
  public pdsUrl?: URL // The PDS URL, driven by the did doc
  public session?: AtpSessionData

  private fetch: Fetch
  private client: AtpClient
  private persistSession?: AtpPersistSessionHandler
  private refreshSessionPromise: Promise<void> | undefined

  constructor(options: SessionDispatcherOptions) {
    super((url, init) => this._dispatch(url, init))

    this.serviceUrl = new URL(options.service)
    this.fetch = options.fetch || globalThis.fetch
    this.setPersistSessionHandler(options.persistSession)

    // Private API client used to perform session management API calls on the
    // service endpoint.
    this.client = new AtpClient({
      fetch: async (request) => (0, this.fetch)(request),
      service: () => this.getServiceUrl(),
      headers: {
        authorization: () =>
          this.session?.accessJwt && `Bearer ${this.session.accessJwt}`,
      },
    })
  }

  getServiceUrl() {
    return this.serviceUrl
  }

  getDispatchUrl() {
    return this.pdsUrl || this.serviceUrl
  }

  /**
   * Internal fetch method that will be triggered by the XRPC Dispatcher (parent
   * class). This method will:
   * - Set the proper origin for the request (pds or service)
   * - Add the proper auth headers to the request
   * - Handle session refreshes
   *
   * @note We define this as a method on the prototype instead of inlining the
   * function in the constructor for readability.
   */
  protected async _dispatch(
    url: string,
    reqInit: RequestInit,
  ): Promise<Response> {
    // wait for any active session-refreshes to finish
    await this.refreshSessionPromise

    const initialUri = new URL(url, this.getDispatchUrl())
    const initialReq = new Request(initialUri, reqInit)

    const initialToken = this.session?.accessJwt
    if (!initialToken || initialReq.headers.has('authorization')) {
      return (0, this.fetch)(initialReq)
    }

    initialReq.headers.set('authorization', `Bearer ${initialToken}`)
    const initialRes = await (0, this.fetch)(initialReq)

    if (!this.session?.refreshJwt) {
      return initialRes
    }
    const isExpiredToken = await isErrorResponse(
      initialRes,
      [400],
      ['ExpiredToken'],
    )

    if (!isExpiredToken) {
      return initialRes
    }

    try {
      await this.refreshSession()
    } catch {
      return initialRes
    }

    if (reqInit?.signal?.aborted) {
      return initialRes
    }

    // The stream was already consumed. We cannot retry the request. A solution
    // would be to tee() the input stream but that would bufferize the entire
    // stream in memory which can lead to memory starvation. Instead, we will
    // return the original response and let the calling code handle retries.
    if (ReadableStream && reqInit.body instanceof ReadableStream) {
      return initialRes
    }

    // Return initial "ExpiredToken" response if the session was not refreshed.
    const updatedToken = this.session?.accessJwt
    if (!updatedToken || updatedToken === initialToken) {
      return initialRes
    }

    // Make sure the initial request is cancelled to avoid leaking resources
    // (NodeJS 👀): https://undici.nodejs.org/#/?id=garbage-collection
    await initialRes.body?.cancel()

    // We need to re-compute the URI in case the PDS endpoint has changed
    const updatedUri = new URL(url, this.getDispatchUrl())
    const updatedReq = new Request(updatedUri, reqInit)

    updatedReq.headers.set('authorization', `Bearer ${updatedToken}`)

    return await (0, this.fetch)(updatedReq)
  }

  getDid() {
    const did = this.session?.did
    if (did) return did

    throw new Error('Not logged in')
  }

  /**
   * Is there any active session?
   */
  get hasSession() {
    return !!this.session
  }

  /**
   * Sets a WhatWG "fetch()" function to be used for making HTTP requests.
   */
  setFetchHandler(fetch: Fetch = globalThis.fetch) {
    this.fetch = fetch
  }

  /**
   * Sets the "Persist Session" method which can be used to store access tokens
   * as they change.
   */
  setPersistSessionHandler(handler?: AtpPersistSessionHandler) {
    this.persistSession = handler?.bind(null)
  }

  /**
   * Create a new account and hydrate its session in this agent.
   */
  async createAccount(
    opts: ComAtprotoServerCreateAccount.InputSchema,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    try {
      const res = await this.client.com.atproto.server.createAccount(opts)
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
        email: opts.email,
        emailConfirmed: false,
        emailAuthFactor: false,
      }
      this._updateApiEndpoint(res.data.didDoc)
      return res
    } catch (e) {
      this.session = undefined
      throw e
    } finally {
      if (this.session) {
        this.persistSession?.('create', this.session)
      } else {
        this.persistSession?.('create-failed', undefined)
      }
    }
  }

  /**
   * Start a new session with this agent.
   */
  async login(
    opts: AtpAgentLoginOpts,
  ): Promise<ComAtprotoServerCreateSession.Response> {
    try {
      const res = await this.client.com.atproto.server.createSession({
        identifier: opts.identifier,
        password: opts.password,
        authFactorToken: opts.authFactorToken,
      })
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
        email: res.data.email,
        emailConfirmed: res.data.emailConfirmed,
        emailAuthFactor: res.data.emailAuthFactor,
      }
      this._updateApiEndpoint(res.data.didDoc)
      return res
    } catch (e) {
      this.session = undefined
      throw e
    } finally {
      if (this.session) {
        this.persistSession?.('create', this.session)
      } else {
        this.persistSession?.('create-failed', undefined)
      }
    }
  }

  /**
   * Resume a pre-existing session with this agent.
   */
  async resumeSession(
    session: AtpSessionData,
  ): Promise<ComAtprotoServerGetSession.Response> {
    try {
      this.session = session
      // For this particular call, we want this._dispatch() to be used in order
      // to refresh the session if needed. To do so, we use a (new) AtpClient
      // instance to build the HTTP request, and pass "this" as the dispatcher
      // so that this._dispatch() is called.
      const res = await new AtpClient(this).com.atproto.server.getSession()
      if (res.data.did !== this.session.did) {
        throw new XRPCError(
          ResponseType.InvalidRequest,
          'Invalid session',
          'InvalidDID',
        )
      }
      this.session.email = res.data.email
      this.session.handle = res.data.handle
      this.session.emailConfirmed = res.data.emailConfirmed
      this.session.emailAuthFactor = res.data.emailAuthFactor
      this._updateApiEndpoint(res.data.didDoc)
      this.persistSession?.('update', this.session)
      return res
    } catch (e) {
      this.session = undefined

      if (e instanceof XRPCError) {
        /*
         * `ExpiredToken` and `InvalidToken` are handled in
         * `this_refreshSession`, and emit an `expired` event there.
         *
         * Everything else is handled here.
         */
        if (
          [1, 408, 425, 429, 500, 502, 503, 504, 522, 524].includes(e.status)
        ) {
          this.persistSession?.('network-error', undefined)
        } else {
          this.persistSession?.('expired', undefined)
        }
      } else {
        this.persistSession?.('network-error', undefined)
      }

      throw e
    }
  }

  /**
   * Internal helper to refresh sessions
   * - Wraps the actual implementation in a promise-guard to ensure only
   *   one refresh is attempted at a time.
   */
  async refreshSession(): Promise<void> {
    return (this.refreshSessionPromise ||= this._refreshSessionInner().finally(
      () => {
        this.refreshSessionPromise = undefined
      },
    ))
  }

  /**
   * Internal helper to refresh sessions (actual behavior)
   */
  async _refreshSessionInner() {
    if (!this.session?.refreshJwt) {
      return
    }

    try {
      const res = await this.client.com.atproto.server.refreshSession(
        undefined,
        { headers: { authorization: `Bearer ${this.session.refreshJwt}` } },
      )
      // succeeded, update the session
      this.session = {
        ...this.session,
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
      }
      this._updateApiEndpoint(res.data.didDoc)
      this.persistSession?.('update', this.session)
    } catch (err) {
      if (
        err instanceof XRPCError &&
        err.error &&
        ['ExpiredToken', 'InvalidToken'].includes(err.error)
      ) {
        // failed due to a bad refresh token
        this.session = undefined
        this.persistSession?.('expired', undefined)
      }
      // else: other failures should be ignored - the issue will
      // propagate in the _dispatch() second attempt to run
      // the request
    }
  }

  /**
   * Helper to update the pds endpoint dynamically.
   *
   * The session methods (create, resume, refresh) may respond with the user's
   * did document which contains the user's canonical PDS endpoint. That endpoint
   * may differ from the endpoint used to contact the server. We capture that
   * PDS endpoint and update the client to use that given endpoint for future
   * requests. (This helps ensure smooth migrations between PDSes, especially
   * when the PDSes are operated by a single org.)
   */
  private _updateApiEndpoint(didDoc: unknown) {
    if (isValidDidDoc(didDoc)) {
      const endpoint = getPdsEndpoint(didDoc)
      this.pdsUrl = endpoint ? new URL(endpoint) : undefined
    } else {
      // If the did doc is invalid, we clear the pdsUrl (should never happen)
      this.pdsUrl = undefined
    }
  }
}

function isErrorObject(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}

async function isErrorResponse(
  response: Response,
  status: number[],
  errorNames: string[],
): Promise<boolean> {
  if (!status.includes(response.status)) return false
  // Some engines (react-native 👀) don't expose a response.body property...
  // if (!response.body) return false
  try {
    const json = await peekJson(response, 10 * 1024)
    return isErrorObject(json) && (errorNames as any[]).includes(json.error)
  } catch (err) {
    return false
  }
}

async function peekJson(
  response: Response,
  maxSize = Infinity,
): Promise<unknown> {
  if (extractType(response) !== 'application/json') throw new Error('Not JSON')
  if (extractLength(response) > maxSize) throw new Error('Response too large')
  return response.clone().json()
}

function extractLength({ headers }: Response) {
  return headers.get('Content-Length')
    ? Number(headers.get('Content-Length'))
    : NaN
}

function extractType({ headers }: Response) {
  return headers.get('Content-Type')?.split(';')[0]?.trim()
}
