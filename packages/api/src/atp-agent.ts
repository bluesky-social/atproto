import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import {
  ErrorResponseBody,
  Gettable,
  ResponseType,
  XRPCError,
  XrpcClient,
  errorResponseBody,
} from '@atproto/xrpc'
import { Agent } from './agent'
import {
  ComAtprotoServerCreateAccount,
  ComAtprotoServerCreateSession,
  ComAtprotoServerGetSession,
  ComAtprotoServerNS,
} from './client'
import { schemas } from './client/lexicons'
import { SessionManager } from './session-manager'
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
 * A wrapper around the {@link Agent} class that uses credential based session
 * management. This class also exposes most of the session management methods
 * directly.
 *
 * This class will be deprecated in the near future. Use {@link Agent} directly
 * with a {@link CredentialSession} instead:
 *
 *  ```ts
 *  const session = new CredentialSession({
 *    service: new URL('https://example.com'),
 *  })
 *
 *  const agent = new Agent(session)
 *  ```
 */
export class AtpAgent extends Agent {
  readonly sessionManager: CredentialSession

  constructor(options: AtpAgentOptions | CredentialSession) {
    const sessionManager =
      options instanceof CredentialSession
        ? options
        : new CredentialSession(
            new URL(options.service),
            options.fetch,
            options.persistSession,
          )

    super(sessionManager)

    // This assignment is already being done in the super constructor, but we
    // need to do it here to make TypeScript happy.
    this.sessionManager = sessionManager

    if (!(options instanceof CredentialSession) && options.headers) {
      for (const [key, value] of options.headers) {
        this.setHeader(key, value)
      }
    }
  }

  clone(): AtpAgent {
    return this.copyInto(new AtpAgent(this.sessionManager))
  }

  get session() {
    return this.sessionManager.session
  }

  get hasSession() {
    return this.sessionManager.hasSession
  }

  get did() {
    return this.sessionManager.did
  }

  get serviceUrl() {
    return this.sessionManager.serviceUrl
  }

  get pdsUrl() {
    return this.sessionManager.pdsUrl
  }

  get dispatchUrl() {
    return this.sessionManager.dispatchUrl
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

  /** @deprecated use {@link AtpAgent.serviceUrl} instead */
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
 * Credentials (username / password) based session manager. Instances of this
 * class will typically be used as the session manager for an {@link AtpAgent}.
 * They can also be used with an {@link XrpcClient}, if you want to use you
 * own Lexicons.
 */
export class CredentialSession implements SessionManager {
  public pdsUrl?: URL // The PDS URL, driven by the did doc
  public session?: AtpSessionData
  public refreshSessionPromise: Promise<void> | undefined

  /**
   * Private {@link ComAtprotoServerNS} used to perform session management API
   * calls on the service endpoint. Calls performed by this agent will not be
   * authenticated using the user's session to allow proper manual configuration
   * of the headers when performing session management operations.
   */
  protected server = new ComAtprotoServerNS(
    // Note that the use of the codegen "schemas" (to instantiate `this.api`),
    // as well as the use of `ComAtprotoServerNS` will cause this class to
    // reference (way) more code than it actually needs. It is not possible,
    // with the current state of the codegen, to generate a client that only
    // includes the methods that are actually used by this class. This is a
    // known limitation that should be addressed in a future version of the
    // codegen.
    new XrpcClient((url, init) => {
      return (0, this.fetch)(new URL(url, this.serviceUrl), init)
    }, schemas),
  )

  constructor(
    public readonly serviceUrl: URL,
    public fetch = globalThis.fetch,
    protected readonly persistSession?: AtpPersistSessionHandler,
  ) {}

  get did() {
    return this.session?.did
  }

  get dispatchUrl() {
    return this.pdsUrl || this.serviceUrl
  }

  get hasSession() {
    return !!this.session
  }

  /**
   * Sets a WhatWG "fetch()" function to be used for making HTTP requests.
   */
  setFetch(fetch = globalThis.fetch) {
    this.fetch = fetch
  }

  async fetchHandler(url: string, init?: RequestInit): Promise<Response> {
    // wait for any active session-refreshes to finish
    await this.refreshSessionPromise

    const initialUri = new URL(url, this.dispatchUrl)
    const initialReq = new Request(initialUri, init)

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
    const updatedReq = new Request(updatedUri, init)

    updatedReq.headers.set('authorization', `Bearer ${updatedToken}`)

    return await (0, this.fetch)(updatedReq)
  }

  /**
   * Create a new account and hydrate its session in this agent.
   */
  async createAccount(
    data: ComAtprotoServerCreateAccount.InputSchema,
    opts?: ComAtprotoServerCreateAccount.CallOptions,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    try {
      const res = await this.server.createAccount(data, opts)
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
      const res = await this.server.createSession({
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
        await this.server.deleteSession(undefined, {
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
      const res = await this.server
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
              const res = await this.server.refreshSession(undefined, {
                headers: { authorization: `Bearer ${session.refreshJwt}` },
              })

              session.accessJwt = res.data.accessJwt
              session.refreshJwt = res.data.refreshJwt

              return this.server.getSession(undefined, {
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
      const res = await this.server.refreshSession(undefined, {
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
