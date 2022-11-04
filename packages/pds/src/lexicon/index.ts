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
import * as ComAtprotoHandleResolve from './types/com/atproto/handle/resolve'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribe from './types/com/atproto/repo/describe'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
import * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
import * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
import * as ComAtprotoSessionGet from './types/com/atproto/session/get'
import * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
import * as ComAtprotoSyncGetRoot from './types/com/atproto/sync/getRoot'
import * as ComAtprotoSyncUpdateRepo from './types/com/atproto/sync/updateRepo'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorSearch from './types/app/bsky/actor/search'
import * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetLikedBy from './types/app/bsky/feed/getLikedBy'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationList from './types/app/bsky/notification/list'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'

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
  handle: HandleNS
  repo: RepoNS
  server: ServerNS
  session: SessionNS
  sync: SyncNS

  constructor(server: Server) {
    this._server = server
    this.account = new AccountNS(server)
    this.handle = new HandleNS(server)
    this.repo = new RepoNS(server)
    this.server = new ServerNS(server)
    this.session = new SessionNS(server)
    this.sync = new SyncNS(server)
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

export class HandleNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  resolve(handler: ComAtprotoHandleResolve.Handler) {
    const schema = 'com.atproto.handle.resolve' // @ts-ignore
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

  describe(handler: ComAtprotoRepoDescribe.Handler) {
    const schema = 'com.atproto.repo.describe' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getRecord(handler: ComAtprotoRepoGetRecord.Handler) {
    const schema = 'com.atproto.repo.getRecord' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  listRecords(handler: ComAtprotoRepoListRecords.Handler) {
    const schema = 'com.atproto.repo.listRecords' // @ts-ignore
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

export class SyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getRepo(handler: ComAtprotoSyncGetRepo.Handler) {
    const schema = 'com.atproto.sync.getRepo' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getRoot(handler: ComAtprotoSyncGetRoot.Handler) {
    const schema = 'com.atproto.sync.getRoot' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  updateRepo(handler: ComAtprotoSyncUpdateRepo.Handler) {
    const schema = 'com.atproto.sync.updateRepo' // @ts-ignore
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

  getProfile(handler: AppBskyActorGetProfile.Handler) {
    const schema = 'app.bsky.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  search(handler: AppBskyActorSearch.Handler) {
    const schema = 'app.bsky.actor.search' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  searchTypeahead(handler: AppBskyActorSearchTypeahead.Handler) {
    const schema = 'app.bsky.actor.searchTypeahead' // @ts-ignore
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

  getAuthorFeed(handler: AppBskyFeedGetAuthorFeed.Handler) {
    const schema = 'app.bsky.feed.getAuthorFeed' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getLikedBy(handler: AppBskyFeedGetLikedBy.Handler) {
    const schema = 'app.bsky.feed.getLikedBy' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getPostThread(handler: AppBskyFeedGetPostThread.Handler) {
    const schema = 'app.bsky.feed.getPostThread' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getRepostedBy(handler: AppBskyFeedGetRepostedBy.Handler) {
    const schema = 'app.bsky.feed.getRepostedBy' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getTimeline(handler: AppBskyFeedGetTimeline.Handler) {
    const schema = 'app.bsky.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }
}

export class GraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getFollowers(handler: AppBskyGraphGetFollowers.Handler) {
    const schema = 'app.bsky.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
  }

  getFollows(handler: AppBskyGraphGetFollows.Handler) {
    const schema = 'app.bsky.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(schema, handler)
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

  list(handler: AppBskyNotificationList.Handler) {
    const schema = 'app.bsky.notification.list' // @ts-ignore
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
