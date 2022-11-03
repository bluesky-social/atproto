import {
  CallOptions,
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
  QueryParams,
  ResponseType,
  XRPCError,
  XRPCResponse,
} from '@atproto/xrpc'
import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { Client, ServiceClient } from './client'
import * as CreateSession from './client/types/com/atproto/session/create'
import * as RefreshSession from './client/types/com/atproto/session/refresh'
import * as CreateAccount from './client/types/com/atproto/session/create'

const CREATE_SESSION = 'com.atproto.session.create'
const REFRESH_SESSION = 'com.atproto.session.refresh'
const DELETE_SESSION = 'com.atproto.session.delete'
const CREATE_ACCOUNT = 'com.atproto.account.create'

export class SessionClient extends Client {
  service(serviceUri: string | URL): SessionServiceClient {
    const xrpcService = new SessionXrpcServiceClient(this.xrpc, serviceUri)
    return new SessionServiceClient(this, xrpcService)
  }
}

const defaultInst = new SessionClient()
export default defaultInst

export class SessionServiceClient extends ServiceClient {
  xrpc: SessionXrpcServiceClient
  sessionManager: SessionManager
  constructor(baseClient: Client, xrpcService: SessionXrpcServiceClient) {
    super(baseClient, xrpcService)
    this.sessionManager = this.xrpc.sessionManager
  }
}

export class SessionXrpcServiceClient extends XrpcServiceClient {
  sessionManager = new SessionManager()
  refreshing?: Promise<XRPCResponse>

  constructor(baseClient: XrpcClient, serviceUri: string | URL) {
    super(baseClient, serviceUri)
    this.sessionManager.on('session', () => {
      // Maintain access token headers when session changes
      const accessHeaders = this.sessionManager.accessHeaders()
      if (accessHeaders) {
        this.setHeader('authorization', accessHeaders.authorization)
      } else {
        this.unsetHeader('authorization')
      }
    })
  }

  async call(
    methodNsid: string,
    params?: QueryParams,
    data?: unknown,
    opts?: CallOptions,
  ) {
    const original = (overrideOpts?: CallOptions) =>
      super.call(methodNsid, params, data, overrideOpts ?? opts)

    // If someone is setting credentials manually, pass through as an escape hatch
    if (opts?.headers?.authorization) {
      return await original()
    }

    // Manage concurrent refreshes on session refresh
    if (methodNsid === REFRESH_SESSION) {
      return await this.refresh(opts)
    }

    // Complete any pending session refresh and then continue onto the original request with fresh credentials
    await this.refreshing

    // Setup session on session or account creation
    if (methodNsid === CREATE_SESSION || methodNsid === CREATE_ACCOUNT) {
      const result = await original()
      const { accessJwt, refreshJwt } =
        result.data as CreateSession.OutputSchema & CreateAccount.OutputSchema
      this.sessionManager.set({ accessJwt, refreshJwt })
      return result
    }

    // Clear session on session deletion
    if (methodNsid === DELETE_SESSION) {
      const result = await original({
        ...opts,
        headers: {
          ...opts?.headers,
          ...this.sessionManager.refreshHeaders(),
        },
      })
      this.sessionManager.unset()
      return result
    }

    // For all other requests, if failed due to an expired token, refresh and retry with fresh credentials
    try {
      return await original()
    } catch (err) {
      if (
        err instanceof XRPCError &&
        err.status === ResponseType.InvalidRequest &&
        err.error === 'ExpiredToken' &&
        this.sessionManager.active()
      ) {
        await this.refresh(opts)
        return await original()
      }
      throw err
    }
  }

  // Ensures a single refresh request at a time, deduping concurrent requests.
  async refresh(opts?: CallOptions) {
    this.refreshing ??= this._refresh(opts)
    try {
      return await this.refreshing
    } finally {
      this.refreshing = undefined
    }
  }

  private async _refresh(opts?: CallOptions) {
    try {
      const result = await super.call(REFRESH_SESSION, undefined, undefined, {
        ...opts,
        headers: {
          ...opts?.headers,
          ...this.sessionManager.refreshHeaders(),
        },
      })
      const { accessJwt, refreshJwt } =
        result.data as RefreshSession.OutputSchema
      this.sessionManager.set({ accessJwt, refreshJwt })
      return result
    } catch (err) {
      if (
        err instanceof XRPCError &&
        err.status === ResponseType.InvalidRequest &&
        (err.error === 'ExpiredToken' || err.error === 'InvalidToken')
      ) {
        this.sessionManager.unset()
      }
      throw err
    }
  }
}

export class SessionManager extends (EventEmitter as new () => TypedEmitter<SessionEvents>) {
  session?: Session
  get() {
    return this.session
  }
  set(session: Session) {
    this.session = session
    this.emit('session', session)
  }
  unset() {
    this.session = undefined
    this.emit('session', undefined)
  }
  active() {
    return !!this.session
  }
  accessHeaders() {
    return (
      this.session && {
        authorization: `Bearer ${this.session.accessJwt}`,
      }
    )
  }
  refreshHeaders() {
    return (
      this.session && {
        authorization: `Bearer ${this.session.refreshJwt}`,
      }
    )
  }
}

export type Session = {
  refreshJwt: string
  accessJwt: string
}

type SessionEvents = {
  session: (session?: Session) => void
}
