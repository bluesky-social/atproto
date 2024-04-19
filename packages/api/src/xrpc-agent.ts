import { getPdsEndpoint, isValidDidDoc } from '@atproto/common-web'
import { OAuthClient } from '@atproto/oauth-client'
import {
  ErrorResponseBody,
  ResponseType,
  XRPCError,
  XrpcAgent,
  errorResponseBody,
  isXrpcAgent,
} from '@atproto/xrpc'
import {
  AtpClient,
  ComAtprotoServerCreateAccount,
  ComAtprotoServerCreateSession,
  ComAtprotoServerGetSession,
} from './client'
import {
  AtpAgentLoginOpts,
  AtpPersistSessionHandler,
  AtpSessionData,
  ComAtprotoServerXrpcAgentOptionsOpts,
} from './types'

export interface AuthenticatedXrpcAgent extends XrpcAgent {
  ownDid(): string | PromiseLike<string>
}

export function isAuthenticatedXrpcAgent<T>(
  agent: T,
): agent is T & AuthenticatedXrpcAgent {
  return (
    isXrpcAgent(agent) &&
    'ownDid' in agent &&
    typeof agent.ownDid === 'function'
  )
}

export class OAuthXrpcAgent implements AuthenticatedXrpcAgent {
  constructor(protected oauthClient: OAuthClient) {}

  async fetchHandler(url: string, init: RequestInit): Promise<Response> {
    return this.oauthClient.request(url, init)
  }

  async ownDid() {
    const { sub } = await this.oauthClient.getTokenSet(false)
    return sub
  }
}

/**
 * An XrpcAgent that uses legacy "com.atproto.server" endpoints to manage
 * sessions and route XRPC requests.
 *
 * @deprecated Use {@link OAuthClient} instead.
 */
export class ComAtprotoServerXrpcAgent implements AuthenticatedXrpcAgent {
  protected service: URL
  protected api: AtpClient
  protected session?: AtpSessionData
  protected pdsUrl?: URL // The PDS URL, driven by the did doc. May be undefined.

  protected _persistSession?: AtpPersistSessionHandler
  protected _refreshSessionPromise: Promise<void> | undefined

  constructor(opts: ComAtprotoServerXrpcAgentOptionsOpts) {
    this.service = new URL(opts.service)
    this._persistSession = opts.persistSession

    // 'this' being an XrpcAgent, it *would* be used as agent for the AtpClient
    // constructor (`new AtpClient(this)`). However, since this class's
    // fetchHandler performs session management, which we don't want to happen
    // for session management purposes, we create an inner XrpcAgent that
    // doesn't have session management and uses `this.service` instead of trying
    // to send requests towards the `this.pdsUrl`.
    this.api = new AtpClient({
      service: () => this.service,
      headers: () => ({
        authorization:
          this.session?.accessJwt && `Bearer ${this.session?.accessJwt}`,
      }),
    })
  }

  ownDid() {
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
   * Sets the "Persist Session" method which can be used to store access tokens
   * as they change.
   */
  setPersistSessionHandler(handler?: AtpPersistSessionHandler) {
    this._persistSession = handler
  }

  /**
   * Create a new account and hydrate its session in this agent.
   */
  async createAccount(
    opts: ComAtprotoServerCreateAccount.InputSchema,
  ): Promise<ComAtprotoServerCreateAccount.Response> {
    try {
      const res = await this.api.com.atproto.server.createAccount(opts)
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
        email: opts.email,
        emailConfirmed: false,
      }
      this._updateApiEndpoint(res.data.didDoc)
      return res
    } catch (e) {
      this.session = undefined
      throw e
    } finally {
      if (this.session) {
        this._persistSession?.('create', this.session)
      } else {
        this._persistSession?.('create-failed', undefined)
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
      const res = await this.api.com.atproto.server.createSession({
        identifier: opts.identifier,
        password: opts.password,
      })
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
        email: res.data.email,
        emailConfirmed: res.data.emailConfirmed,
      }
      this._updateApiEndpoint(res.data.didDoc)
      return res
    } catch (e) {
      this.session = undefined
      throw e
    } finally {
      if (this.session) {
        this._persistSession?.('create', this.session)
      } else {
        this._persistSession?.('create-failed', undefined)
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
      const res = await this.api.com.atproto.server.getSession()
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
      this._updateApiEndpoint(res.data.didDoc)
      this._persistSession?.('update', this.session)
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
          this._persistSession?.('network-error', undefined)
        } else {
          this._persistSession?.('expired', undefined)
        }
      } else {
        this._persistSession?.('network-error', undefined)
      }

      throw e
    }
  }

  /**
   * Internal fetch method that will be triggered by the XRPC Agent. This method
   * will:
   * - Set the proper origin for the request (pds or service)
   * - Add the proper headers to the request
   * - Handle session refreshes
   *
   * @note We define this as a method on the prototype instead of inlining the
   * function in the constructor to allow overriding in subclasses.
   */
  async fetchHandler(url: string, reqInit: RequestInit): Promise<Response> {
    // wait for any active session-refreshes to finish
    await this._refreshSessionPromise

    const uri = new URL(url, this.pdsUrl || this.service)
    const req = new Request(uri, reqInit)

    // If reqInit contained an Authorization header, avoid overwriting it
    const hasAuth = req.headers.has('authorization')

    // Clone the request in prevision of a potential retry (required to avoid
    // consuming the body twice, in case reqInit.body is a stream)
    const reqClone = req.clone()
    try {
      if (!hasAuth && this.session?.accessJwt) {
        req.headers.set('authorization', `Bearer ${this.session.accessJwt}`)
      }

      // send the request
      const res = await globalThis.fetch(req)

      // handle session-refreshes as needed
      if (
        this.session?.refreshJwt &&
        res.status === 400 &&
        isErrorResponse(
          await res
            .clone()
            .json()
            .catch(() => null),
          ['ExpiredToken'],
        )
      ) {
        try {
          // attempt refresh
          await this.refreshSession()

          // New uri in case the pdsUrl has changed during the refresh
          const newUri = new URL(url, this.pdsUrl || this.service)
          const newReq = new Request(newUri, reqClone)
          if (!hasAuth && this.session?.accessJwt) {
            req.headers.set('authorization', `Bearer ${this.session.accessJwt}`)
          }

          // resend the request with the new access token
          return await globalThis.fetch(newReq)
        } finally {
          res.body?.cancel()
        }
      }

      return res
    } finally {
      // Do not leave the body un-consumed. This required in some environments
      // when reqInit.body is a stream (NodeJS 👀)
      if (!reqClone.bodyUsed) await reqClone.body?.cancel()
    }
  }

  /**
   * Internal helper to refresh sessions
   * - Wraps the actual implementation in a promise-guard to ensure only
   *   one refresh is attempted at a time.
   */
  async refreshSession() {
    if (this._refreshSessionPromise) {
      return this._refreshSessionPromise
    }
    this._refreshSessionPromise = this._refreshSessionInner()
    try {
      await this._refreshSessionPromise
    } finally {
      this._refreshSessionPromise = undefined
    }
  }

  /**
   * Internal helper to refresh sessions (actual behavior)
   */
  private async _refreshSessionInner() {
    if (!this.session?.refreshJwt) {
      return
    }

    try {
      const res = await this.api.com.atproto.server.refreshSession()
      // succeeded, update the session
      this.session = {
        ...this.session,
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
      }
      this._updateApiEndpoint(res.data.didDoc)
      this._persistSession?.('update', this.session)
    } catch (err) {
      if (
        err instanceof XRPCError &&
        err.error &&
        ['ExpiredToken', 'InvalidToken'].includes(err.error)
      ) {
        // failed due to a bad refresh token
        this.session = undefined
        this._persistSession?.('expired', undefined)
      }
      // else: other failures should be ignored - the issue will
      // propagate in the fetchHandler() handler's second attempt to run
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

function isErrorResponse(body: unknown, errorNames: string[]): boolean {
  return (
    isErrorObject(body) &&
    typeof body.error === 'string' &&
    errorNames.includes(body.error)
  )
}
