import { ErrorResponseBody, errorResponseBody } from '@atproto/xrpc'
import { defaultFetchHandler } from '@atproto/xrpc'
import {
  AtpBaseClient,
  AtpServiceClient,
  ComAtprotoAccountCreate,
  ComAtprotoSessionCreate,
  ComAtprotoSessionGet,
  ComAtprotoSessionRefresh,
} from './client'
import {
  AtpSessionData,
  AtpAgentCreateAccountOpts,
  AtpAgentLoginOpts,
  AptAgentFetchHandler,
  AtpAgentFetchHandlerResponse,
  AtpAgentGlobalOpts,
  AtpPersistSessionHandler,
  AtpAgentOpts,
} from './types'

const REFRESH_SESSION = 'com.atproto.session.refresh'

/**
 * An ATP "Agent"
 * Manages session token lifecycles and provides convenience methods.
 */
export class AtpAgent {
  service: URL
  api: AtpServiceClient
  session?: AtpSessionData

  private _baseClient: AtpBaseClient
  private _persistSession?: AtpPersistSessionHandler
  private _refreshSessionPromise: Promise<void> | undefined

  /**
   * The `fetch` implementation; must be implemented for your platform.
   */
  static fetch: AptAgentFetchHandler | undefined = defaultFetchHandler

  /**
   * Configures the API globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    AtpAgent.fetch = opts.fetch
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
    opts: AtpAgentCreateAccountOpts,
  ): Promise<ComAtprotoAccountCreate.Response> {
    try {
      const res = await this.api.com.atproto.account.create({
        handle: opts.handle,
        password: opts.password,
        email: opts.email,
        inviteCode: opts.inviteCode,
      })
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
      }
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
  ): Promise<ComAtprotoSessionCreate.Response> {
    try {
      const res = await this.api.com.atproto.session.create({
        identifier: opts.identifier,
        password: opts.password,
      })
      this.session = {
        accessJwt: res.data.accessJwt,
        refreshJwt: res.data.refreshJwt,
        handle: res.data.handle,
        did: res.data.did,
      }
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
  ): Promise<ComAtprotoSessionGet.Response> {
    try {
      this.session = session
      const res = await this.api.com.atproto.session.get()
      if (!res.success || res.data.did !== this.session.did) {
        throw new Error('Invalid session')
      }
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
   * Internal helper to add authorization headers to requests.
   */
  private _addAuthHeader(reqHeaders: Record<string, string>) {
    if (!reqHeaders.authorization && this.session?.accessJwt) {
      return {
        ...reqHeaders,
        authorization: `Bearer ${this.session.accessJwt}`,
      }
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
      this._addAuthHeader(reqHeaders),
      reqBody,
    )

    // handle session-refreshes as needed
    if (isErrorResponse(res, ['ExpiredToken']) && this.session?.refreshJwt) {
      // attempt refresh
      await this._refreshSession()

      // resend the request with the new access token
      res = await AtpAgent.fetch(
        reqUri,
        reqMethod,
        this._addAuthHeader(reqHeaders),
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
  private async _refreshSession() {
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
    const url = new URL(this.service.origin)
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
        accessJwt: res.body.accessJwt,
        refreshJwt: res.body.refreshJwt,
        handle: res.body.handle,
        did: res.body.did,
      }
      this._persistSession?.('update', this.session)
    }
    // else: other failures should be ignored - the issue will
    // propagate in the _fetch() handler's second attempt to run
    // the request
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
): v is ComAtprotoSessionRefresh.OutputSchema {
  try {
    client.xrpc.lex.assertValidXrpcOutput('com.atproto.session.refresh', v)
    return true
  } catch {
    return false
  }
}
