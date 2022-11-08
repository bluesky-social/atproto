/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
} from '@atproto/xrpc-server'
import { methodSchemas } from './schemas'
import * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
import * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
import * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
import * as ComAtprotoAccountGet from './types/com/atproto/account/get'
import * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
import * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
import * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
import * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
import * as ComAtprotoSessionGet from './types/com/atproto/session/get'
import * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
import * as AppBskyActorCreateScene from './types/app/bsky/actor/createScene'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'

export const APP_BSKY_GRAPH = {
  AssertCreator: 'app.bsky.graph.assertCreator',
  AssertMember: 'app.bsky.graph.assertMember',
}
export const APP_BSKY_SYSTEM = {
  ActorScene: 'app.bsky.system.actorScene',
  ActorUser: 'app.bsky.system.actorUser',
}

export function createServer(): Server {
  return new Server()
}

export class Server {
  xrpc: XrpcServer = createXrpcServer(methodSchemas)
  com: ComNS
  app: AppNS

  constructor() {
    this.com = new ComNS(this)
    this.app = new AppNS(this)
  }
}

export class ComNS {
  _server: Server
  atproto: AtprotoNS

  constructor(server: Server) {
    this._server = server
    this.atproto = new AtprotoNS(server)
  }
}

export class AtprotoNS {
  _server: Server
  account: AccountNS
  repo: RepoNS
  server: ServerNS
  session: SessionNS

  constructor(server: Server) {
    this._server = server
    this.account = new AccountNS(server)
    this.repo = new RepoNS(server)
    this.server = new ServerNS(server)
    this.session = new SessionNS(server)
  }
}

export class AccountNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  create(handler: ComAtprotoAccountCreate.Handler) {
    const schema = 'com.atproto.account.create' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  createInviteCode(handler: ComAtprotoAccountCreateInviteCode.Handler) {
    const schema = 'com.atproto.account.createInviteCode' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  delete(handler: ComAtprotoAccountDelete.Handler) {
    const schema = 'com.atproto.account.delete' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  get(handler: ComAtprotoAccountGet.Handler) {
    const schema = 'com.atproto.account.get' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  requestPasswordReset(handler: ComAtprotoAccountRequestPasswordReset.Handler) {
    const schema = 'com.atproto.account.requestPasswordReset' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  resetPassword(handler: ComAtprotoAccountResetPassword.Handler) {
    const schema = 'com.atproto.account.resetPassword' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class RepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  batchWrite(handler: ComAtprotoRepoBatchWrite.Handler) {
    const schema = 'com.atproto.repo.batchWrite' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  createRecord(handler: ComAtprotoRepoCreateRecord.Handler) {
    const schema = 'com.atproto.repo.createRecord' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  deleteRecord(handler: ComAtprotoRepoDeleteRecord.Handler) {
    const schema = 'com.atproto.repo.deleteRecord' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  putRecord(handler: ComAtprotoRepoPutRecord.Handler) {
    const schema = 'com.atproto.repo.putRecord' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class ServerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAccountsConfig(handler: ComAtprotoServerGetAccountsConfig.Handler) {
    const schema = 'com.atproto.server.getAccountsConfig' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class SessionNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  create(handler: ComAtprotoSessionCreate.Handler) {
    const schema = 'com.atproto.session.create' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  delete(handler: ComAtprotoSessionDelete.Handler) {
    const schema = 'com.atproto.session.delete' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  get(handler: ComAtprotoSessionGet.Handler) {
    const schema = 'com.atproto.session.get' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  refresh(handler: ComAtprotoSessionRefresh.Handler) {
    const schema = 'com.atproto.session.refresh' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class AppNS {
  _server: Server
  bsky: BskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new BskyNS(server)
  }
}

export class BskyNS {
  _server: Server
  actor: ActorNS
  feed: FeedNS
  graph: GraphNS
  notification: NotificationNS
  system: SystemNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ActorNS(server)
    this.feed = new FeedNS(server)
    this.graph = new GraphNS(server)
    this.notification = new NotificationNS(server)
    this.system = new SystemNS(server)
  }
}

export class ActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createScene(handler: AppBskyActorCreateScene.Handler) {
    const schema = 'app.bsky.actor.createScene' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  updateProfile(handler: AppBskyActorUpdateProfile.Handler) {
    const schema = 'app.bsky.actor.updateProfile' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class FeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  setVote(handler: AppBskyFeedSetVote.Handler) {
    const schema = 'app.bsky.feed.setVote' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class GraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class NotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getCount(handler: AppBskyNotificationGetCount.Handler) {
    const schema = 'app.bsky.notification.getCount' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  updateSeen(handler: AppBskyNotificationUpdateSeen.Handler) {
    const schema = 'app.bsky.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class SystemNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}
