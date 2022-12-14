/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
  Options as XrpcOptions,
  AuthVerifier,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons'
import * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
import * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
import * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
import * as ComAtprotoAccountGet from './types/com/atproto/account/get'
import * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
import * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
import * as ComAtprotoBlobUpload from './types/com/atproto/blob/upload'
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
import * as AppBskyActorCreateScene from './types/app/bsky/actor/createScene'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorSearch from './types/app/bsky/actor/search'
import * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyFeedGetVotes from './types/app/bsky/feed/getVotes'
import * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
import * as AppBskyGraphGetAssertions from './types/app/bsky/graph/getAssertions'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetMembers from './types/app/bsky/graph/getMembers'
import * as AppBskyGraphGetMemberships from './types/app/bsky/graph/getMemberships'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationList from './types/app/bsky/notification/list'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'

export const APP_BSKY_GRAPH = {
  AssertCreator: 'app.bsky.graph.assertCreator',
  AssertMember: 'app.bsky.graph.assertMember',
}
export const APP_BSKY_SYSTEM = {
  ActorScene: 'app.bsky.system.actorScene',
  ActorUser: 'app.bsky.system.actorUser',
}

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  com: ComNS
  app: AppNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
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
  blob: BlobNS
  handle: HandleNS
  repo: RepoNS
  server: ServerNS
  session: SessionNS
  sync: SyncNS

  constructor(server: Server) {
    this._server = server
    this.account = new AccountNS(server)
    this.blob = new BlobNS(server)
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

  create<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAccountCreate.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.account.create' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createInviteCode<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAccountCreateInviteCode.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.account.createInviteCode' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  delete<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAccountDelete.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.account.delete' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  get<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAccountGet.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.account.get' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPasswordReset<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAccountRequestPasswordReset.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.account.requestPasswordReset' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resetPassword<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAccountResetPassword.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.account.resetPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class BlobNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  upload<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoBlobUpload.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.blob.upload' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class HandleNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  resolve<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoHandleResolve.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.handle.resolve' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class RepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  batchWrite<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoBatchWrite.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.batchWrite' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoCreateRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.createRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoDeleteRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.deleteRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  describe<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoDescribe.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.describe' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoGetRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listRecords<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoListRecords.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.listRecords' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoPutRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.putRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ServerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAccountsConfig<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoServerGetAccountsConfig.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.server.getAccountsConfig' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SessionNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  create<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSessionCreate.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.session.create' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  delete<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSessionDelete.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.session.delete' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  get<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSessionGet.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.session.get' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  refresh<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSessionRefresh.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.session.refresh' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getRepo<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetRepo.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRoot<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetRoot.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getRoot' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateRepo<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncUpdateRepo.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.updateRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
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
  embed: EmbedNS
  feed: FeedNS
  graph: GraphNS
  notification: NotificationNS
  system: SystemNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ActorNS(server)
    this.embed = new EmbedNS(server)
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

  createScene<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorCreateScene.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.createScene' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorGetProfile.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestions<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorGetSuggestions.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.getSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  search<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorSearch.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.search' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchTypeahead<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorSearchTypeahead.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.searchTypeahead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorUpdateProfile.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.updateProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class EmbedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class FeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAuthorFeed<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetAuthorFeed.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getAuthorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThread<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetPostThread.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getPostThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepostedBy<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetRepostedBy.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getRepostedBy' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTimeline<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetTimeline.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getVotes<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetVotes.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getVotes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  setVote<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedSetVote.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.setVote' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class GraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAssertions<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetAssertions.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getAssertions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollowers<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetFollowers.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetFollows.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMembers<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetMembers.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getMembers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMemberships<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetMemberships.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getMemberships' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class NotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getCount<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyNotificationGetCount.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.notification.getCount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  list<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyNotificationList.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.notification.list' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateSeen<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyNotificationUpdateSeen.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SystemNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

type ConfigOf<Auth, Handler> =
  | Handler
  | {
      auth?: Auth
      handler: Handler
    }
type ExtractAuth<AV extends AuthVerifier> = Extract<
  Awaited<ReturnType<AV>>,
  { credentials: unknown }
>
