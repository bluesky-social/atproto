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
import { ServiceClient } from './client'
import * as RefreshSession from './client/types/com/atproto/refreshSession'
import * as CreateAccount from './client/types/com/atproto/createAccount'

const REFRESH_SESSION = 'com.atproto.refreshSession'
const DELETE_SESSION = 'com.atproto.deleteSession'
const CREATE_ACCOUNT = 'com.atproto.createAccount'

export class SessionServiceClient extends ServiceClient {
  xrpc: SessionXrpcServiceClient
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

    // Setup session on account creation
    if (methodNsid === CREATE_ACCOUNT) {
      const result = await original()
      const { accessJwt, refreshJwt } =
        result.data as CreateAccount.OutputSchema
      this.sessionManager.set({ accessJwt, refreshJwt })
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
  refresh(opts?: CallOptions) {
    this.refreshing ??= this._refresh(opts)
    return this.refreshing
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
        authorization: `Bearer: ${this.session.accessJwt}`,
      }
    )
  }
  refreshHeaders() {
    return (
      this.session && {
        authorization: `Bearer: ${this.session.refreshJwt}`,
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
