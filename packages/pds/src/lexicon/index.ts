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
import * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
import * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
import * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
import * as ComAtprotoAccountGet from './types/com/atproto/account/get'
import * as ComAtprotoAccountRequestDelete from './types/com/atproto/account/requestDelete'
import * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
import * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
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
import * as ComAtprotoBlobUpload from './types/com/atproto/blob/upload'
import * as ComAtprotoHandleResolve from './types/com/atproto/handle/resolve'
import * as ComAtprotoHandleUpdate from './types/com/atproto/handle/update'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribe from './types/com/atproto/repo/describe'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoReportCreate from './types/com/atproto/report/create'
import * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
import * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
import * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
import * as ComAtprotoSessionGet from './types/com/atproto/session/get'
import * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
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
import * as ComAtprotoSyncSubscribeAllRepos from './types/com/atproto/sync/subscribeAllRepos'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetProfiles from './types/app/bsky/actor/getProfiles'
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
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
import * as AppBskyGraphMute from './types/app/bsky/graph/mute'
import * as AppBskyGraphUnmute from './types/app/bsky/graph/unmute'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationList from './types/app/bsky/notification/list'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskyUnspeccedGetPopular from './types/app/bsky/unspecced/getPopular'

export const COM_ATPROTO_ADMIN = {
  ModerationActionTakedown: 'com.atproto.admin.moderationAction#takedown',
  ModerationActionFlag: 'com.atproto.admin.moderationAction#flag',
  ModerationActionAcknowledge: 'com.atproto.admin.moderationAction#acknowledge',
}
export const COM_ATPROTO_REPORT = {
  ReasonTypeSpam: 'com.atproto.report.reasonType#spam',
  ReasonTypeOther: 'com.atproto.report.reasonType#other',
}
export const APP_BSKY_GRAPH = {
  AssertCreator: 'app.bsky.graph.assertCreator',
  AssertMember: 'app.bsky.graph.assertMember',
}
export const APP_BSKY_SYSTEM = {
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
  admin: AdminNS
  blob: BlobNS
  handle: HandleNS
  repo: RepoNS
  report: ReportNS
  server: ServerNS
  session: SessionNS
  sync: SyncNS

  constructor(server: Server) {
    this._server = server
    this.account = new AccountNS(server)
    this.admin = new AdminNS(server)
    this.blob = new BlobNS(server)
    this.handle = new HandleNS(server)
    this.repo = new RepoNS(server)
    this.report = new ReportNS(server)
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

  requestDelete<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoAccountRequestDelete.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.account.requestDelete' // @ts-ignore
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

  update<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoHandleUpdate.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.handle.update' // @ts-ignore
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

export class ReportNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  create<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoReportCreate.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.report.create' // @ts-ignore
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

  subscribeAllRepos<AV extends StreamAuthVerifier>(
    cfg: ConfigOf<AV, ComAtprotoSyncSubscribeAllRepos.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'com.atproto.sync.subscribeAllRepos' // @ts-ignore
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
  system: SystemNS
  unspecced: UnspeccedNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ActorNS(server)
    this.embed = new EmbedNS(server)
    this.feed = new FeedNS(server)
    this.graph = new GraphNS(server)
    this.notification = new NotificationNS(server)
    this.system = new SystemNS(server)
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

  mute<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphMute.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.mute' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmute<AV extends AuthVerifier>(
    cfg: ConfigOf<AV, AppBskyGraphUnmute.Handler<ExtractAuth<AV>>>,
  ) {
    const nsid = 'app.bsky.graph.unmute' // @ts-ignore
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
