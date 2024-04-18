import { ErrorResponseBody, errorResponseBody } from '@atproto/xrpc'
import { defaultFetchHandler, XRPCError, ResponseType } from '@atproto/xrpc'
import { isValidDidDoc, getPdsEndpoint } from '@atproto/common-web'
import {
  AtpBaseClient,
  AtpServiceClient,
  ComAtprotoServerCreateAccount,
  ComAtprotoServerCreateSession,
  ComAtprotoServerGetSession,
  ComAtprotoServerRefreshSession,
} from './client'
import {
  AtpSessionData,
  AtpAgentLoginOpts,
  AtpAgentFetchHandler,
  AtpAgentFetchHandlerResponse,
  AtpAgentGlobalOpts,
  AtpPersistSessionHandler,
  AtpAgentOpts,
  AtprotoServiceType,
} from './types'
import { BSKY_LABELER_DID } from './const'

const MAX_MOD_AUTHORITIES = 3
const MAX_LABELERS = 10
const REFRESH_SESSION = 'com.atproto.server.refreshSession'

/**
 * An ATP "Agent"
 * Manages session token lifecycles and provides convenience methods.
 */
export class AtpAgent {
  service: URL
  api: AtpServiceClient
  session?: AtpSessionData
  labelersHeader: string[] = []
  proxyHeader: string | undefined
  pdsUrl: URL | undefined // The PDS URL, driven by the did doc. May be undefined.

  protected _baseClient: AtpBaseClient
  protected _persistSession?: AtpPersistSessionHandler
  protected _refreshSessionPromise: Promise<void> | undefined

  get com() {
    return this.api.com
  }

  /**
   * The `fetch` implementation; must be implemented for your platform.
   */
  static fetch: AtpAgentFetchHandler | undefined = defaultFetchHandler

  /**
   * The labelers to be used across all requests with the takedown capability
   */
  static appLabelers: string[] = [BSKY_LABELER_DID]

  /**
   * Configures the API globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    if (opts.fetch) {
      AtpAgent.fetch = opts.fetch
    }
    if (opts.appLabelers) {
      AtpAgent.appLabelers = opts.appLabelers
    }
  }

  constructor(opts: AtpAgentOpts) {
    this.service =
      opts.service instanceof URL ? opts.service : new URL(opts.service)
    this._persistSession = opts.persistSession

    // create an ATP client instance for this agent
    this._baseClient = new AtpBaseClient()
    this._baseClient.xrpc.fetch = this._fetch.bind(this) // patch its fetch implementation
    this.api = this._baseClient.service(opts.service)
  }

  clone() {
    const inst = new AtpAgent({
      service: this.service,
    })
    this.copyInto(inst)
    return inst
  }

  copyInto(inst: AtpAgent) {
    inst.session = this.session
    inst.labelersHeader = this.labelersHeader
    inst.proxyHeader = this.proxyHeader
    inst.pdsUrl = this.pdsUrl
    inst.api.xrpc.uri = this.pdsUrl || this.service
  }

  withProxy(serviceType: AtprotoServiceType, did: string) {
    const inst = this.clone()
    inst.configureProxyHeader(serviceType, did)
    return inst
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
   * Configures the moderation services to be applied on requests.
   * NOTE: this is called automatically by getPreferences() and the relevant moderation config
   * methods in BskyAgent instances.
   */
  configureLabelersHeader(labelerDids: string[]) {
    this.labelersHeader = labelerDids
  }

  /**
   * Configures the atproto-proxy header to be applied on requests
   */
  configureProxyHeader(serviceType: AtprotoServiceType, did: string) {
    if (did.startsWith('did:')) {
      this.proxyHeader = `${did}#${serviceType}`
    }
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
        emailAuthFactor: false,
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
      this.session.emailAuthFactor = res.data.emailAuthFactor
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
   * Internal helper to add authorization headers to requests.
   */
  private _addHeaders(reqHeaders: Record<string, string>) {
    if (!reqHeaders.authorization && this.session?.accessJwt) {
      reqHeaders = {
        ...reqHeaders,
        authorization: `Bearer ${this.session.accessJwt}`,
      }
    }
    if (this.proxyHeader) {
      reqHeaders = {
        ...reqHeaders,
        'atproto-proxy': this.proxyHeader,
      }
    }
    reqHeaders = {
      ...reqHeaders,
      'atproto-accept-labelers': AtpAgent.appLabelers
        .map((str) => `${str};redact`)
        .concat(this.labelersHeader.filter((str) => str.startsWith('did:')))
        .slice(0, MAX_LABELERS)
        .join(', '),
    }
    return reqHeaders
  }

  /**
   * Internal fetch handler which adds access-token management
   */
  private async _fetch(
    reqUri: string,
    reqMethod: string,
    reqHeaders: Record<string, string>,
    reqBody: any,
  ): Promise<AtpAgentFetchHandlerResponse> {
    if (!AtpAgent.fetch) {
      throw new Error('AtpAgent fetch() method not configured')
    }

    // wait for any active session-refreshes to finish
    await this._refreshSessionPromise

    // send the request
    let res = await AtpAgent.fetch(
      reqUri,
      reqMethod,
      this._addHeaders(reqHeaders),
      reqBody,
    )

    // handle session-refreshes as needed
    if (isErrorResponse(res, ['ExpiredToken']) && this.session?.refreshJwt) {
      // attempt refresh
      await this.refreshSession()

      // resend the request with the new access token
      res = await AtpAgent.fetch(
        reqUri,
        reqMethod,
        this._addHeaders(reqHeaders),
        reqBody,
      )
    }

    return res
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
    if (!AtpAgent.fetch) {
      throw new Error('AtpAgent fetch() method not configured')
    }
    if (!this.session?.refreshJwt) {
      return
    }

    // send the refresh request
    const url = new URL((this.pdsUrl || this.service).origin)
    url.pathname = `/xrpc/${REFRESH_SESSION}`
    const res = await AtpAgent.fetch(
      url.toString(),
      'POST',
      {
        authorization: `Bearer ${this.session.refreshJwt}`,
      },
      undefined,
    )

    if (isErrorResponse(res, ['ExpiredToken', 'InvalidToken'])) {
      // failed due to a bad refresh token
      this.session = undefined
      this._persistSession?.('expired', undefined)
    } else if (isNewSessionObject(this._baseClient, res.body)) {
      // succeeded, update the session
      this.session = {
        ...(this.session || {}),
        accessJwt: res.body.accessJwt,
        refreshJwt: res.body.refreshJwt,
        handle: res.body.handle,
        did: res.body.did,
      }
      this._updateApiEndpoint(res.body.didDoc)
      this._persistSession?.('update', this.session)
    }
    // else: other failures should be ignored - the issue will
    // propagate in the _fetch() handler's second attempt to run
    // the request
  }

  /**
   * Upload a binary blob to the server
   */
  uploadBlob: typeof this.api.com.atproto.repo.uploadBlob = (data, opts) =>
    this.api.com.atproto.repo.uploadBlob(data, opts)

  /**
   * Resolve a handle to a DID
   */
  resolveHandle: typeof this.api.com.atproto.identity.resolveHandle = (
    params,
    opts,
  ) => this.api.com.atproto.identity.resolveHandle(params, opts)

  /**
   * Change the user's handle
   */
  updateHandle: typeof this.api.com.atproto.identity.updateHandle = (
    data,
    opts,
  ) => this.api.com.atproto.identity.updateHandle(data, opts)

  /**
   * Create a moderation report
   */
  createModerationReport: typeof this.api.com.atproto.moderation.createReport =
    (data, opts) => this.api.com.atproto.moderation.createReport(data, opts)

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
    }
    this.api.xrpc.uri = this.pdsUrl || this.service
  }
}

function isErrorObject(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}

function isErrorResponse(
  res: AtpAgentFetchHandlerResponse,
  errorNames: string[],
): boolean {
  if (res.status !== 400) {
    return false
  }
  if (!isErrorObject(res.body)) {
    return false
  }
  return (
    typeof res.body.error === 'string' && errorNames.includes(res.body.error)
  )
}

function isNewSessionObject(
  client: AtpBaseClient,
  v: unknown,
): v is ComAtprotoServerRefreshSession.OutputSchema {
  try {
    client.xrpc.lex.assertValidXrpcOutput(
      'com.atproto.server.refreshSession',
      v,
    )
    return true
  } catch {
    return false
  }
}
