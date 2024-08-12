import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import {
  ErrorResponseBody,
  Gettable,
  ResponseType,
  XRPCError,
  combineHeaders,
  errorResponseBody,
} from '@atproto/xrpc'
import { Agent } from './agent'
import {
  AtpBaseClient,
  ComAtprotoServerCreateAccount,
  ComAtprotoServerCreateSession,
  ComAtprotoServerGetSession,
} from './client'
import {
  AtpAgentLoginOpts,
  AtpPersistSessionHandler,
  AtpSessionData,
} from './types'

const ReadableStream = globalThis.ReadableStream as
  | typeof globalThis.ReadableStream
  | undefined

export type AtpAgentOptions = {
  service: string | URL
  persistSession?: AtpPersistSessionHandler
  fetch?: typeof globalThis.fetch
  headers?: Iterable<[string, Gettable<null | string>]>
}

/**
 * An {@link AtpAgent} extends the {@link Agent} abstract class by
 * implementing password based session management.
 */
export class AtpAgent extends Agent {
  public readonly headers: Map<string, Gettable<null | string>>
  public readonly sessionManager: SessionManager

  constructor(options: AtpAgentOptions | SessionManager) {
    super(async (url: string, init?: RequestInit): Promise<Response> => {
      // wait for any active session-refreshes to finish
      await this.sessionManager.refreshSessionPromise

      const initialHeaders = combineHeaders(init?.headers, this.headers)
      const reqInit = { ...init, headers: initialHeaders }

      const initialUri = new URL(url, this.dispatchUrl)
      const initialReq = new Request(initialUri, reqInit)

      const initialToken = this.session?.accessJwt
      if (!initialToken || initialReq.headers.has('authorization')) {
        return (0, this.sessionManager.fetch)(initialReq)
      }

      initialReq.headers.set('authorization', `Bearer ${initialToken}`)
      const initialRes = await (0, this.sessionManager.fetch)(initialReq)

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
        await this.sessionManager.refreshSession()
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
      const updatedUri = new URL(url, this.dispatchUrl)
      const updatedReq = new Request(updatedUri, reqInit)

      updatedReq.headers.set('authorization', `Bearer ${updatedToken}`)

      return await (0, this.sessionManager.fetch)(updatedReq)
    })

    if (options instanceof SessionManager) {
      this.headers = new Map()
      this.sessionManager = options
    } else {
      this.headers = new Map(options.headers)
      this.sessionManager = new SessionManager(
        new URL(options.service),
        options.fetch,
        options.persistSession,
      )
    }
  }

  clone(): AtpAgent {
    return this.copyInto(new AtpAgent(this.sessionManager))
  }

  copyInto<T extends Agent>(inst: T): T {
    if (inst instanceof AtpAgent) {
      for (const [key] of inst.headers) {
        inst.unsetHeader(key)
      }
      for (const [key, value] of this.headers) {
        inst.setHeader(key, value)
      }
    }
    return super.copyInto(inst)
  }

  setHeader(key: string, value: Gettable<null | string>): void {
    this.headers.set(key.toLowerCase(), value)
  }

  unsetHeader(key: string): void {
    this.headers.delete(key.toLowerCase())
  }

  get session() {
    return this.sessionManager.session
  }

  get hasSession() {
    return !!this.session
  }

  get did() {
    return this.session?.did
  }

  get serviceUrl() {
    return this.sessionManager.serviceUrl
  }

  get pdsUrl() {
    return this.sessionManager.pdsUrl
  }

  get dispatchUrl() {
    return this.pdsUrl || this.serviceUrl
  }

  /** @deprecated use {@link serviceUrl} instead */
  get service() {
    return this.serviceUrl
  }

  get persistSession() {
    throw new Error(
      'Cannot set persistSession directly. "persistSession" is defined through the constructor and will be invoked automatically when session data changes.',
    )
  }

  set persistSession(v: unknown) {
    throw new Error(
      'Cannot set persistSession directly. "persistSession" must be defined in the constructor and can no longer be changed.',
    )
  }

  /** @deprecated This will be removed in OAuthAtpAgent */
  getServiceUrl() {
    return this.serviceUrl
  }

  async resumeSession(
    session: AtpSessionData,
  ): Promise<ComAtprotoServerGetSession.Response> {
    return this.sessionManager.resumeSession(session)
  }

  async createAccount(
    data: ComAtprotoServerCreateAccount.InputSchema,
    opts?: ComAtprotoServerCreateAccount.CallOptions,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    return this.sessionManager.createAccount(data, opts)
  }

  async login(
    opts: AtpAgentLoginOpts,
  ): Promise<ComAtprotoServerCreateSession.Response> {
    return this.sessionManager.login(opts)
  }

  async logout(): Promise<void> {
    return this.sessionManager.logout()
  }
}

/**
 * Private class meant to be used by clones of {@link AtpAgent} so they can
 * share the same session across multiple instances (with different
 * proxying/labelers/headers options).
 */
class SessionManager {
  public pdsUrl?: URL // The PDS URL, driven by the did doc
  public session?: AtpSessionData
  public refreshSessionPromise: Promise<void> | undefined

  /**
   * Private {@link AtpBaseClient} used to perform session management API
   * calls on the service endpoint. Calls performed by this agent will not be
   * authenticated using the user's session.
   */
  protected api = new AtpBaseClient((url, init) => {
    return (0, this.fetch)(new URL(url, this.serviceUrl), init)
  })

  constructor(
    public readonly serviceUrl: URL,
    public fetch = globalThis.fetch,
    protected readonly persistSession?: AtpPersistSessionHandler,
  ) {}

  /**
   * Sets a WhatWG "fetch()" function to be used for making HTTP requests.
   */
  setFetch(fetch = globalThis.fetch) {
    this.fetch = fetch
  }

  /**
   * Create a new account and hydrate its session in this agent.
   */
  async createAccount(
    data: ComAtprotoServerCreateAccount.InputSchema,
    opts?: ComAtprotoServerCreateAccount.CallOptions,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    try {
      const res = await this.api.com.atproto.server.createAccount(data, opts)
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
        email: data.email,
        emailConfirmed: false,
        emailAuthFactor: false,
        active: true,
      }
      this.persistSession?.('create', this.session)
      this._updateApiEndpoint(res.data.didDoc)
      return res
    } catch (e) {
      this.session = undefined
      this.persistSession?.('create-failed', undefined)
      throw e
    }
  }

  /**
   * Start a new session with this agent.
   */
  async login(
    opts: AtpAgentLoginOpts,
  ): Promise<ComAtprotoServerCreateSession.Response> {
    try {
      const res = await this.api.com.atproto.server.createSession({
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
        active: res.data.active ?? true,
        status: res.data.status,
      }
      this._updateApiEndpoint(res.data.didDoc)
      this.persistSession?.('create', this.session)
      return res
    } catch (e) {
      this.session = undefined
      this.persistSession?.('create-failed', undefined)
      throw e
    }
  }

  async logout(): Promise<void> {
    if (this.session) {
      try {
        await this.api.com.atproto.server.deleteSession(undefined, {
          headers: {
            authorization: `Bearer ${this.session.accessJwt}`,
          },
        })
      } catch {
        // Ignore errors
      } finally {
        this.session = undefined
        this.persistSession?.('expired', undefined)
      }
    }
  }

  /**
   * Resume a pre-existing session with this agent.
   */
  async resumeSession(
    session: AtpSessionData,
  ): Promise<ComAtprotoServerGetSession.Response> {
    this.session = session

    try {
      const res = await this.api.com.atproto.server
        .getSession(undefined, {
          headers: { authorization: `Bearer ${session.accessJwt}` },
        })
        .catch(async (err) => {
          if (
            err instanceof XRPCError &&
            ['ExpiredToken', 'InvalidToken'].includes(err.error) &&
            session.refreshJwt
          ) {
            try {
              const res = await this.api.com.atproto.server.refreshSession(
                undefined,
                { headers: { authorization: `Bearer ${session.refreshJwt}` } },
              )

              session.accessJwt = res.data.accessJwt
              session.refreshJwt = res.data.refreshJwt

              return this.api.com.atproto.server.getSession(undefined, {
                headers: { authorization: `Bearer ${session.accessJwt}` },
              })
            } catch {
              // Noop, we'll throw the original error
            }
          }
          throw err
        })

      if (res.data.did !== session.did) {
        throw new XRPCError(
          ResponseType.InvalidRequest,
          'Invalid session',
          'InvalidDID',
        )
      }

      session.email = res.data.email
      session.handle = res.data.handle
      session.emailConfirmed = res.data.emailConfirmed
      session.emailAuthFactor = res.data.emailAuthFactor
      session.active = res.data.active ?? true
      session.status = res.data.status

      // protect against concurrent session updates
      if (this.session === session) {
        this._updateApiEndpoint(res.data.didDoc)
        this.persistSession?.('update', session)
      }

      return res
    } catch (err) {
      // protect against concurrent session updates
      if (this.session === session) {
        this.session = undefined
        this.persistSession?.(
          err instanceof XRPCError &&
            ['ExpiredToken', 'InvalidToken'].includes(err.error)
            ? 'expired'
            : 'network-error',
          undefined,
        )
      }

      throw err
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
  private async _refreshSessionInner() {
    if (!this.session?.refreshJwt) {
      return
    }

    try {
      const res = await this.api.com.atproto.server.refreshSession(undefined, {
        headers: { authorization: `Bearer ${this.session.refreshJwt}` },
      })
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
