/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
  Options as XrpcOptions,
  AuthVerifier,
  StreamAuthVerifier,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons'
import * as ComAtprotoAdminGetModerationAction from './types/com/atproto/admin/getModerationAction'
import * as ComAtprotoAdminGetModerationActions from './types/com/atproto/admin/getModerationActions'
import * as ComAtprotoAdminGetModerationReport from './types/com/atproto/admin/getModerationReport'
import * as ComAtprotoAdminGetModerationReports from './types/com/atproto/admin/getModerationReports'
import * as ComAtprotoAdminGetRecord from './types/com/atproto/admin/getRecord'
import * as ComAtprotoAdminGetRepo from './types/com/atproto/admin/getRepo'
import * as ComAtprotoAdminResolveModerationReports from './types/com/atproto/admin/resolveModerationReports'
import * as ComAtprotoAdminReverseModerationAction from './types/com/atproto/admin/reverseModerationAction'
import * as ComAtprotoAdminSearchRepos from './types/com/atproto/admin/searchRepos'
import * as ComAtprotoAdminTakeModerationAction from './types/com/atproto/admin/takeModerationAction'
import * as ComAtprotoIdentityResolveHandle from './types/com/atproto/identity/resolveHandle'
import * as ComAtprotoIdentityUpdateHandle from './types/com/atproto/identity/updateHandle'
import * as ComAtprotoModerationCreateReport from './types/com/atproto/moderation/createReport'
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob'
import * as ComAtprotoServerCreateAccount from './types/com/atproto/server/createAccount'
import * as ComAtprotoServerCreateInviteCode from './types/com/atproto/server/createInviteCode'
import * as ComAtprotoServerCreateSession from './types/com/atproto/server/createSession'
import * as ComAtprotoServerDeleteAccount from './types/com/atproto/server/deleteAccount'
import * as ComAtprotoServerDeleteSession from './types/com/atproto/server/deleteSession'
import * as ComAtprotoServerDescribeServer from './types/com/atproto/server/describeServer'
import * as ComAtprotoServerGetSession from './types/com/atproto/server/getSession'
import * as ComAtprotoServerRefreshSession from './types/com/atproto/server/refreshSession'
import * as ComAtprotoServerRequestAccountDelete from './types/com/atproto/server/requestAccountDelete'
import * as ComAtprotoServerRequestPasswordReset from './types/com/atproto/server/requestPasswordReset'
import * as ComAtprotoServerResetPassword from './types/com/atproto/server/resetPassword'
import * as ComAtprotoSyncGetBlob from './types/com/atproto/sync/getBlob'
import * as ComAtprotoSyncGetBlocks from './types/com/atproto/sync/getBlocks'
import * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout'
import * as ComAtprotoSyncGetCommitPath from './types/com/atproto/sync/getCommitPath'
import * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead'
import * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
import * as ComAtprotoSyncListBlobs from './types/com/atproto/sync/listBlobs'
import * as ComAtprotoSyncNotifyOfUpdate from './types/com/atproto/sync/notifyOfUpdate'
import * as ComAtprotoSyncRequestCrawl from './types/com/atproto/sync/requestCrawl'
import * as ComAtprotoSyncSubscribeRepos from './types/com/atproto/sync/subscribeRepos'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorSearchActors from './types/app/bsky/actor/searchActors'
import * as AppBskyActorSearchActorsTypeahead from './types/app/bsky/actor/searchActorsTypeahead'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetLikes from './types/app/bsky/feed/getLikes'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
import * as AppBskyGraphMuteActor from './types/app/bsky/graph/muteActor'
import * as AppBskyGraphUnmuteActor from './types/app/bsky/graph/unmuteActor'
import * as AppBskyNotificationGetUnreadCount from './types/app/bsky/notification/getUnreadCount'
import * as AppBskyNotificationListNotifications from './types/app/bsky/notification/listNotifications'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskyUnspeccedGetPopular from './types/app/bsky/unspecced/getPopular'

export const COM_ATPROTO_ADMIN = {
  DefsTakedown: 'com.atproto.admin.defs#takedown',
  DefsFlag: 'com.atproto.admin.defs#flag',
  DefsAcknowledge: 'com.atproto.admin.defs#acknowledge',
}
export const COM_ATPROTO_MODERATION = {
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
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
  admin: AdminNS
  identity: IdentityNS
  moderation: ModerationNS
  repo: RepoNS
  server: ServerNS
  sync: SyncNS

  constructor(server: Server) {
    this._server = server
    this.admin = new AdminNS(server)
    this.identity = new IdentityNS(server)
    this.moderation = new ModerationNS(server)
    this.repo = new RepoNS(server)
    this.server = new ServerNS(server)
    this.sync = new SyncNS(server)
  }
}

export class AdminNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getModerationAction<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminGetModerationAction.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.getModerationAction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getModerationActions<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminGetModerationActions.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.getModerationActions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getModerationReport<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminGetModerationReport.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.getModerationReport' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getModerationReports<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminGetModerationReports.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.getModerationReports' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAdminGetRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.admin.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepo<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAdminGetRepo.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.admin.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveModerationReports<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminResolveModerationReports.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.resolveModerationReports' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  reverseModerationAction<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminReverseModerationAction.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.reverseModerationAction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchRepos<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAdminSearchRepos.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.admin.searchRepos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  takeModerationAction<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoAdminTakeModerationAction.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.admin.takeModerationAction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class IdentityNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  resolveHandle<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoIdentityResolveHandle.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.identity.resolveHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateHandle<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoIdentityUpdateHandle.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.identity.updateHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createReport<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoModerationCreateReport.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.moderation.createReport' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class RepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  applyWrites<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoApplyWrites.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.applyWrites' // @ts-ignore
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

  describeRepo<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoDescribeRepo.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.describeRepo' // @ts-ignore
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

  uploadBlob<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoRepoUploadBlob.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.repo.uploadBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ServerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createAccount<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerCreateAccount.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.createAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createInviteCode<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoServerCreateInviteCode.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.server.createInviteCode' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createSession<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerCreateSession.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.createSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteAccount<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerDeleteAccount.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.deleteAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteSession<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerDeleteSession.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.deleteSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  describeServer<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerDescribeServer.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.describeServer' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSession<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerGetSession.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.getSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  refreshSession<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerRefreshSession.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.refreshSession' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestAccountDelete<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoServerRequestAccountDelete.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.server.requestAccountDelete' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPasswordReset<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      ComAtprotoServerRequestPasswordReset.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'com.atproto.server.requestPasswordReset' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resetPassword<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoServerResetPassword.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.server.resetPassword' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getBlob<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetBlob.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBlocks<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetBlocks.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getCheckout<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetCheckout.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getCheckout' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getCommitPath<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetCommitPath.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getCommitPath' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getHead<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetHead.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getHead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetRecord.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepo<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncGetRepo.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listBlobs<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncListBlobs.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.listBlobs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  notifyOfUpdate<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncNotifyOfUpdate.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.notifyOfUpdate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestCrawl<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncRequestCrawl.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.requestCrawl' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  subscribeRepos<AV extends StreamAuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncSubscribeRepos.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.subscribeRepos' // @ts-ignore
    return this._server.xrpc.streamMethod(nsid, cfg)
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
  richtext: RichtextNS
  unspecced: UnspeccedNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ActorNS(server)
    this.embed = new EmbedNS(server)
    this.feed = new FeedNS(server)
    this.graph = new GraphNS(server)
    this.notification = new NotificationNS(server)
    this.richtext = new RichtextNS(server)
    this.unspecced = new UnspeccedNS(server)
  }
}

export class ActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorGetProfile.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorGetProfiles.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestions<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorGetSuggestions.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.getSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyActorSearchActors.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActorsTypeahead<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      AppBskyActorSearchActorsTypeahead.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'app.bsky.actor.searchActorsTypeahead' // @ts-ignore
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

  getLikes<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyFeedGetLikes.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.feed.getLikes' // @ts-ignore
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
}

export class GraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
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

  getMutes<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphGetMutes.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.getMutes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteActor<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphMuteActor.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.muteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteActor<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphUnmuteActor.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.unmuteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class NotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getUnreadCount<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      AppBskyNotificationGetUnreadCount.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'app.bsky.notification.getUnreadCount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listNotifications<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      AppBskyNotificationListNotifications.Handler<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'app.bsky.notification.listNotifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateSeen<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyNotificationUpdateSeen.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class RichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class UnspeccedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getPopular<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyUnspeccedGetPopular.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.unspecced.getPopular' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

type ConfigOf<Auth, Handler> =
  | Handler
  | {
      auth?: Auth
      handler: Handler
    }
type ExtractAuth<AV extends AuthVerifier | StreamAuthVerifier> = Extract<
  Awaited<ReturnType<AV>>,
  { credentials: unknown }
>
