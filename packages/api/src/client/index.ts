/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
} from '@atproto/xrpc'
import { schemas } from './lexicons'
import * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
import * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
import * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
import * as ComAtprotoAccountGet from './types/com/atproto/account/get'
import * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
import * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
import * as ComAtprotoAdminGetModerationAction from './types/com/atproto/admin/getModerationAction'
import * as ComAtprotoAdminGetModerationActions from './types/com/atproto/admin/getModerationActions'
import * as ComAtprotoAdminGetModerationReport from './types/com/atproto/admin/getModerationReport'
import * as ComAtprotoAdminGetModerationReports from './types/com/atproto/admin/getModerationReports'
import * as ComAtprotoAdminGetRecord from './types/com/atproto/admin/getRecord'
import * as ComAtprotoAdminGetRepo from './types/com/atproto/admin/getRepo'
import * as ComAtprotoAdminModerationAction from './types/com/atproto/admin/moderationAction'
import * as ComAtprotoAdminModerationReport from './types/com/atproto/admin/moderationReport'
import * as ComAtprotoAdminRecord from './types/com/atproto/admin/record'
import * as ComAtprotoAdminRepo from './types/com/atproto/admin/repo'
import * as ComAtprotoAdminResolveModerationReports from './types/com/atproto/admin/resolveModerationReports'
import * as ComAtprotoAdminReverseModerationAction from './types/com/atproto/admin/reverseModerationAction'
import * as ComAtprotoAdminSearchRepos from './types/com/atproto/admin/searchRepos'
import * as ComAtprotoAdminTakeModerationAction from './types/com/atproto/admin/takeModerationAction'
import * as ComAtprotoBlobUpload from './types/com/atproto/blob/upload'
import * as ComAtprotoHandleResolve from './types/com/atproto/handle/resolve'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
import * as ComAtprotoRepoDescribe from './types/com/atproto/repo/describe'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
import * as ComAtprotoRepoRecordRef from './types/com/atproto/repo/recordRef'
import * as ComAtprotoRepoRepoRef from './types/com/atproto/repo/repoRef'
import * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
import * as ComAtprotoReportCreate from './types/com/atproto/report/create'
import * as ComAtprotoReportReasonType from './types/com/atproto/report/reasonType'
import * as ComAtprotoReportSubject from './types/com/atproto/report/subject'
import * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
import * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
import * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
import * as ComAtprotoSessionGet from './types/com/atproto/session/get'
import * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
import * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout'
import * as ComAtprotoSyncGetCommitPath from './types/com/atproto/sync/getCommitPath'
import * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead'
import * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorProfile from './types/app/bsky/actor/profile'
import * as AppBskyActorRef from './types/app/bsky/actor/ref'
import * as AppBskyActorSearch from './types/app/bsky/actor/search'
import * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
import * as AppBskyEmbedImages from './types/app/bsky/embed/images'
import * as AppBskyFeedFeedViewPost from './types/app/bsky/feed/feedViewPost'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyFeedGetVotes from './types/app/bsky/feed/getVotes'
import * as AppBskyFeedPost from './types/app/bsky/feed/post'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
import * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
import * as AppBskyFeedVote from './types/app/bsky/feed/vote'
import * as AppBskyGraphAssertCreator from './types/app/bsky/graph/assertCreator'
import * as AppBskyGraphAssertMember from './types/app/bsky/graph/assertMember'
import * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
import * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
import * as AppBskyGraphMute from './types/app/bsky/graph/mute'
import * as AppBskyGraphUnmute from './types/app/bsky/graph/unmute'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationList from './types/app/bsky/notification/list'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskySystemActorUser from './types/app/bsky/system/actorUser'
import * as AppBskySystemDeclRef from './types/app/bsky/system/declRef'
import * as AppBskySystemDeclaration from './types/app/bsky/system/declaration'

export * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
export * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
export * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
export * as ComAtprotoAccountGet from './types/com/atproto/account/get'
export * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
export * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
export * as ComAtprotoAdminGetModerationAction from './types/com/atproto/admin/getModerationAction'
export * as ComAtprotoAdminGetModerationActions from './types/com/atproto/admin/getModerationActions'
export * as ComAtprotoAdminGetModerationReport from './types/com/atproto/admin/getModerationReport'
export * as ComAtprotoAdminGetModerationReports from './types/com/atproto/admin/getModerationReports'
export * as ComAtprotoAdminGetRecord from './types/com/atproto/admin/getRecord'
export * as ComAtprotoAdminGetRepo from './types/com/atproto/admin/getRepo'
export * as ComAtprotoAdminModerationAction from './types/com/atproto/admin/moderationAction'
export * as ComAtprotoAdminModerationReport from './types/com/atproto/admin/moderationReport'
export * as ComAtprotoAdminRecord from './types/com/atproto/admin/record'
export * as ComAtprotoAdminRepo from './types/com/atproto/admin/repo'
export * as ComAtprotoAdminResolveModerationReports from './types/com/atproto/admin/resolveModerationReports'
export * as ComAtprotoAdminReverseModerationAction from './types/com/atproto/admin/reverseModerationAction'
export * as ComAtprotoAdminSearchRepos from './types/com/atproto/admin/searchRepos'
export * as ComAtprotoAdminTakeModerationAction from './types/com/atproto/admin/takeModerationAction'
export * as ComAtprotoBlobUpload from './types/com/atproto/blob/upload'
export * as ComAtprotoHandleResolve from './types/com/atproto/handle/resolve'
export * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
export * as ComAtprotoRepoDescribe from './types/com/atproto/repo/describe'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
export * as ComAtprotoRepoRecordRef from './types/com/atproto/repo/recordRef'
export * as ComAtprotoRepoRepoRef from './types/com/atproto/repo/repoRef'
export * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef'
export * as ComAtprotoReportCreate from './types/com/atproto/report/create'
export * as ComAtprotoReportReasonType from './types/com/atproto/report/reasonType'
export * as ComAtprotoReportSubject from './types/com/atproto/report/subject'
export * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
export * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
export * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
export * as ComAtprotoSessionGet from './types/com/atproto/session/get'
export * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
export * as ComAtprotoSyncGetCheckout from './types/com/atproto/sync/getCheckout'
export * as ComAtprotoSyncGetCommitPath from './types/com/atproto/sync/getCommitPath'
export * as ComAtprotoSyncGetHead from './types/com/atproto/sync/getHead'
export * as ComAtprotoSyncGetRecord from './types/com/atproto/sync/getRecord'
export * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
export * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
export * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile'
export * as AppBskyActorRef from './types/app/bsky/actor/ref'
export * as AppBskyActorSearch from './types/app/bsky/actor/search'
export * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
export * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
export * as AppBskyEmbedExternal from './types/app/bsky/embed/external'
export * as AppBskyEmbedImages from './types/app/bsky/embed/images'
export * as AppBskyFeedFeedViewPost from './types/app/bsky/feed/feedViewPost'
export * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
export * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
export * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
export * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
export * as AppBskyFeedGetVotes from './types/app/bsky/feed/getVotes'
export * as AppBskyFeedPost from './types/app/bsky/feed/post'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
export * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
export * as AppBskyFeedVote from './types/app/bsky/feed/vote'
export * as AppBskyGraphAssertCreator from './types/app/bsky/graph/assertCreator'
export * as AppBskyGraphAssertMember from './types/app/bsky/graph/assertMember'
export * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
export * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
export * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
export * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
export * as AppBskyGraphGetMutes from './types/app/bsky/graph/getMutes'
export * as AppBskyGraphMute from './types/app/bsky/graph/mute'
export * as AppBskyGraphUnmute from './types/app/bsky/graph/unmute'
export * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
export * as AppBskyNotificationList from './types/app/bsky/notification/list'
export * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
export * as AppBskySystemActorUser from './types/app/bsky/system/actorUser'
export * as AppBskySystemDeclRef from './types/app/bsky/system/declRef'
export * as AppBskySystemDeclaration from './types/app/bsky/system/declaration'

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

export class Client {
  xrpc: XrpcClient = new XrpcClient()

  constructor() {
    this.xrpc.addLexicons(schemas)
  }

  service(serviceUri: string | URL): ServiceClient {
    return new ServiceClient(this, this.xrpc.service(serviceUri))
  }
}

const defaultInst = new Client()
export default defaultInst

export class ServiceClient {
  _baseClient: Client
  xrpc: XrpcServiceClient
  com: ComNS
  app: AppNS

  constructor(baseClient: Client, xrpcService: XrpcServiceClient) {
    this._baseClient = baseClient
    this.xrpc = xrpcService
    this.com = new ComNS(this)
    this.app = new AppNS(this)
  }

  setHeader(key: string, value: string): void {
    this.xrpc.setHeader(key, value)
  }
}

export class ComNS {
  _service: ServiceClient
  atproto: AtprotoNS

  constructor(service: ServiceClient) {
    this._service = service
    this.atproto = new AtprotoNS(service)
  }
}

export class AtprotoNS {
  _service: ServiceClient
  account: AccountNS
  admin: AdminNS
  blob: BlobNS
  handle: HandleNS
  repo: RepoNS
  report: ReportNS
  server: ServerNS
  session: SessionNS
  sync: SyncNS

  constructor(service: ServiceClient) {
    this._service = service
    this.account = new AccountNS(service)
    this.admin = new AdminNS(service)
    this.blob = new BlobNS(service)
    this.handle = new HandleNS(service)
    this.repo = new RepoNS(service)
    this.report = new ReportNS(service)
    this.server = new ServerNS(service)
    this.session = new SessionNS(service)
    this.sync = new SyncNS(service)
  }
}

export class AccountNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  create(
    data?: ComAtprotoAccountCreate.InputSchema,
    opts?: ComAtprotoAccountCreate.CallOptions,
  ): Promise<ComAtprotoAccountCreate.Response> {
    return this._service.xrpc
      .call('com.atproto.account.create', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountCreate.toKnownErr(e)
      })
  }

  createInviteCode(
    data?: ComAtprotoAccountCreateInviteCode.InputSchema,
    opts?: ComAtprotoAccountCreateInviteCode.CallOptions,
  ): Promise<ComAtprotoAccountCreateInviteCode.Response> {
    return this._service.xrpc
      .call('com.atproto.account.createInviteCode', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountCreateInviteCode.toKnownErr(e)
      })
  }

  delete(
    data?: ComAtprotoAccountDelete.InputSchema,
    opts?: ComAtprotoAccountDelete.CallOptions,
  ): Promise<ComAtprotoAccountDelete.Response> {
    return this._service.xrpc
      .call('com.atproto.account.delete', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountDelete.toKnownErr(e)
      })
  }

  get(
    params?: ComAtprotoAccountGet.QueryParams,
    opts?: ComAtprotoAccountGet.CallOptions,
  ): Promise<ComAtprotoAccountGet.Response> {
    return this._service.xrpc
      .call('com.atproto.account.get', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAccountGet.toKnownErr(e)
      })
  }

  requestPasswordReset(
    data?: ComAtprotoAccountRequestPasswordReset.InputSchema,
    opts?: ComAtprotoAccountRequestPasswordReset.CallOptions,
  ): Promise<ComAtprotoAccountRequestPasswordReset.Response> {
    return this._service.xrpc
      .call('com.atproto.account.requestPasswordReset', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountRequestPasswordReset.toKnownErr(e)
      })
  }

  resetPassword(
    data?: ComAtprotoAccountResetPassword.InputSchema,
    opts?: ComAtprotoAccountResetPassword.CallOptions,
  ): Promise<ComAtprotoAccountResetPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.account.resetPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountResetPassword.toKnownErr(e)
      })
  }
}

export class AdminNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  getModerationAction(
    params?: ComAtprotoAdminGetModerationAction.QueryParams,
    opts?: ComAtprotoAdminGetModerationAction.CallOptions,
  ): Promise<ComAtprotoAdminGetModerationAction.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getModerationAction', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetModerationAction.toKnownErr(e)
      })
  }

  getModerationActions(
    params?: ComAtprotoAdminGetModerationActions.QueryParams,
    opts?: ComAtprotoAdminGetModerationActions.CallOptions,
  ): Promise<ComAtprotoAdminGetModerationActions.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getModerationActions', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetModerationActions.toKnownErr(e)
      })
  }

  getModerationReport(
    params?: ComAtprotoAdminGetModerationReport.QueryParams,
    opts?: ComAtprotoAdminGetModerationReport.CallOptions,
  ): Promise<ComAtprotoAdminGetModerationReport.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getModerationReport', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetModerationReport.toKnownErr(e)
      })
  }

  getModerationReports(
    params?: ComAtprotoAdminGetModerationReports.QueryParams,
    opts?: ComAtprotoAdminGetModerationReports.CallOptions,
  ): Promise<ComAtprotoAdminGetModerationReports.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getModerationReports', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetModerationReports.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoAdminGetRecord.QueryParams,
    opts?: ComAtprotoAdminGetRecord.CallOptions,
  ): Promise<ComAtprotoAdminGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetRecord.toKnownErr(e)
      })
  }

  getRepo(
    params?: ComAtprotoAdminGetRepo.QueryParams,
    opts?: ComAtprotoAdminGetRepo.CallOptions,
  ): Promise<ComAtprotoAdminGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminGetRepo.toKnownErr(e)
      })
  }

  resolveModerationReports(
    data?: ComAtprotoAdminResolveModerationReports.InputSchema,
    opts?: ComAtprotoAdminResolveModerationReports.CallOptions,
  ): Promise<ComAtprotoAdminResolveModerationReports.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.resolveModerationReports', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminResolveModerationReports.toKnownErr(e)
      })
  }

  reverseModerationAction(
    data?: ComAtprotoAdminReverseModerationAction.InputSchema,
    opts?: ComAtprotoAdminReverseModerationAction.CallOptions,
  ): Promise<ComAtprotoAdminReverseModerationAction.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.reverseModerationAction', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminReverseModerationAction.toKnownErr(e)
      })
  }

  searchRepos(
    params?: ComAtprotoAdminSearchRepos.QueryParams,
    opts?: ComAtprotoAdminSearchRepos.CallOptions,
  ): Promise<ComAtprotoAdminSearchRepos.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.searchRepos', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAdminSearchRepos.toKnownErr(e)
      })
  }

  takeModerationAction(
    data?: ComAtprotoAdminTakeModerationAction.InputSchema,
    opts?: ComAtprotoAdminTakeModerationAction.CallOptions,
  ): Promise<ComAtprotoAdminTakeModerationAction.Response> {
    return this._service.xrpc
      .call('com.atproto.admin.takeModerationAction', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAdminTakeModerationAction.toKnownErr(e)
      })
  }
}

export class BlobNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  upload(
    data?: ComAtprotoBlobUpload.InputSchema,
    opts?: ComAtprotoBlobUpload.CallOptions,
  ): Promise<ComAtprotoBlobUpload.Response> {
    return this._service.xrpc
      .call('com.atproto.blob.upload', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoBlobUpload.toKnownErr(e)
      })
  }
}

export class HandleNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  resolve(
    params?: ComAtprotoHandleResolve.QueryParams,
    opts?: ComAtprotoHandleResolve.CallOptions,
  ): Promise<ComAtprotoHandleResolve.Response> {
    return this._service.xrpc
      .call('com.atproto.handle.resolve', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoHandleResolve.toKnownErr(e)
      })
  }
}

export class RepoNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  batchWrite(
    data?: ComAtprotoRepoBatchWrite.InputSchema,
    opts?: ComAtprotoRepoBatchWrite.CallOptions,
  ): Promise<ComAtprotoRepoBatchWrite.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.batchWrite', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoBatchWrite.toKnownErr(e)
      })
  }

  createRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions,
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.createRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  deleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions,
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.deleteRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  describe(
    params?: ComAtprotoRepoDescribe.QueryParams,
    opts?: ComAtprotoRepoDescribe.CallOptions,
  ): Promise<ComAtprotoRepoDescribe.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.describe', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoDescribe.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions,
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  listRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions,
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.listRecords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoListRecords.toKnownErr(e)
      })
  }

  putRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions,
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.putRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
      })
  }
}

export class ReportNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  create(
    data?: ComAtprotoReportCreate.InputSchema,
    opts?: ComAtprotoReportCreate.CallOptions,
  ): Promise<ComAtprotoReportCreate.Response> {
    return this._service.xrpc
      .call('com.atproto.report.create', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoReportCreate.toKnownErr(e)
      })
  }
}

export class ServerNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  getAccountsConfig(
    params?: ComAtprotoServerGetAccountsConfig.QueryParams,
    opts?: ComAtprotoServerGetAccountsConfig.CallOptions,
  ): Promise<ComAtprotoServerGetAccountsConfig.Response> {
    return this._service.xrpc
      .call('com.atproto.server.getAccountsConfig', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoServerGetAccountsConfig.toKnownErr(e)
      })
  }
}

export class SessionNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  create(
    data?: ComAtprotoSessionCreate.InputSchema,
    opts?: ComAtprotoSessionCreate.CallOptions,
  ): Promise<ComAtprotoSessionCreate.Response> {
    return this._service.xrpc
      .call('com.atproto.session.create', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSessionCreate.toKnownErr(e)
      })
  }

  delete(
    data?: ComAtprotoSessionDelete.InputSchema,
    opts?: ComAtprotoSessionDelete.CallOptions,
  ): Promise<ComAtprotoSessionDelete.Response> {
    return this._service.xrpc
      .call('com.atproto.session.delete', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSessionDelete.toKnownErr(e)
      })
  }

  get(
    params?: ComAtprotoSessionGet.QueryParams,
    opts?: ComAtprotoSessionGet.CallOptions,
  ): Promise<ComAtprotoSessionGet.Response> {
    return this._service.xrpc
      .call('com.atproto.session.get', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSessionGet.toKnownErr(e)
      })
  }

  refresh(
    data?: ComAtprotoSessionRefresh.InputSchema,
    opts?: ComAtprotoSessionRefresh.CallOptions,
  ): Promise<ComAtprotoSessionRefresh.Response> {
    return this._service.xrpc
      .call('com.atproto.session.refresh', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSessionRefresh.toKnownErr(e)
      })
  }
}

export class SyncNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  getCheckout(
    params?: ComAtprotoSyncGetCheckout.QueryParams,
    opts?: ComAtprotoSyncGetCheckout.CallOptions,
  ): Promise<ComAtprotoSyncGetCheckout.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getCheckout', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetCheckout.toKnownErr(e)
      })
  }

  getCommitPath(
    params?: ComAtprotoSyncGetCommitPath.QueryParams,
    opts?: ComAtprotoSyncGetCommitPath.CallOptions,
  ): Promise<ComAtprotoSyncGetCommitPath.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getCommitPath', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetCommitPath.toKnownErr(e)
      })
  }

  getHead(
    params?: ComAtprotoSyncGetHead.QueryParams,
    opts?: ComAtprotoSyncGetHead.CallOptions,
  ): Promise<ComAtprotoSyncGetHead.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getHead', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetHead.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoSyncGetRecord.QueryParams,
    opts?: ComAtprotoSyncGetRecord.CallOptions,
  ): Promise<ComAtprotoSyncGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRecord.toKnownErr(e)
      })
  }

  getRepo(
    params?: ComAtprotoSyncGetRepo.QueryParams,
    opts?: ComAtprotoSyncGetRepo.CallOptions,
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }
}

export class AppNS {
  _service: ServiceClient
  bsky: BskyNS

  constructor(service: ServiceClient) {
    this._service = service
    this.bsky = new BskyNS(service)
  }
}

export class BskyNS {
  _service: ServiceClient
  actor: ActorNS
  embed: EmbedNS
  feed: FeedNS
  graph: GraphNS
  notification: NotificationNS
  system: SystemNS

  constructor(service: ServiceClient) {
    this._service = service
    this.actor = new ActorNS(service)
    this.embed = new EmbedNS(service)
    this.feed = new FeedNS(service)
    this.graph = new GraphNS(service)
    this.notification = new NotificationNS(service)
    this.system = new SystemNS(service)
  }
}

export class ActorNS {
  _service: ServiceClient
  profile: ProfileRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.profile = new ProfileRecord(service)
  }

  getProfile(
    params?: AppBskyActorGetProfile.QueryParams,
    opts?: AppBskyActorGetProfile.CallOptions,
  ): Promise<AppBskyActorGetProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getProfile', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetProfile.toKnownErr(e)
      })
  }

  getSuggestions(
    params?: AppBskyActorGetSuggestions.QueryParams,
    opts?: AppBskyActorGetSuggestions.CallOptions,
  ): Promise<AppBskyActorGetSuggestions.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getSuggestions', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetSuggestions.toKnownErr(e)
      })
  }

  search(
    params?: AppBskyActorSearch.QueryParams,
    opts?: AppBskyActorSearch.CallOptions,
  ): Promise<AppBskyActorSearch.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.search', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearch.toKnownErr(e)
      })
  }

  searchTypeahead(
    params?: AppBskyActorSearchTypeahead.QueryParams,
    opts?: AppBskyActorSearchTypeahead.CallOptions,
  ): Promise<AppBskyActorSearchTypeahead.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.searchTypeahead', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearchTypeahead.toKnownErr(e)
      })
  }

  updateProfile(
    data?: AppBskyActorUpdateProfile.InputSchema,
    opts?: AppBskyActorUpdateProfile.CallOptions,
  ): Promise<AppBskyActorUpdateProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.updateProfile', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyActorUpdateProfile.toKnownErr(e)
      })
  }
}

export class ProfileRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyActorProfile.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyActorProfile.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyActorProfile.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.actor.profile'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params },
      { headers },
    )
  }
}

export class EmbedNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }
}

export class FeedNS {
  _service: ServiceClient
  post: PostRecord
  repost: RepostRecord
  vote: VoteRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.post = new PostRecord(service)
    this.repost = new RepostRecord(service)
    this.vote = new VoteRecord(service)
  }

  getAuthorFeed(
    params?: AppBskyFeedGetAuthorFeed.QueryParams,
    opts?: AppBskyFeedGetAuthorFeed.CallOptions,
  ): Promise<AppBskyFeedGetAuthorFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getAuthorFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetAuthorFeed.toKnownErr(e)
      })
  }

  getPostThread(
    params?: AppBskyFeedGetPostThread.QueryParams,
    opts?: AppBskyFeedGetPostThread.CallOptions,
  ): Promise<AppBskyFeedGetPostThread.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getPostThread', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetPostThread.toKnownErr(e)
      })
  }

  getRepostedBy(
    params?: AppBskyFeedGetRepostedBy.QueryParams,
    opts?: AppBskyFeedGetRepostedBy.CallOptions,
  ): Promise<AppBskyFeedGetRepostedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getRepostedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetRepostedBy.toKnownErr(e)
      })
  }

  getTimeline(
    params?: AppBskyFeedGetTimeline.QueryParams,
    opts?: AppBskyFeedGetTimeline.CallOptions,
  ): Promise<AppBskyFeedGetTimeline.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getTimeline', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetTimeline.toKnownErr(e)
      })
  }

  getVotes(
    params?: AppBskyFeedGetVotes.QueryParams,
    opts?: AppBskyFeedGetVotes.CallOptions,
  ): Promise<AppBskyFeedGetVotes.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getVotes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetVotes.toKnownErr(e)
      })
  }

  setVote(
    data?: AppBskyFeedSetVote.InputSchema,
    opts?: AppBskyFeedSetVote.CallOptions,
  ): Promise<AppBskyFeedSetVote.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.setVote', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyFeedSetVote.toKnownErr(e)
      })
  }
}

export class PostRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedPost.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedPost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedPost.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.post'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params },
      { headers },
    )
  }
}

export class RepostRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedRepost.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedRepost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedRepost.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.repost'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params },
      { headers },
    )
  }
}

export class VoteRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyFeedVote.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.vote',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyFeedVote.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.vote',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedVote.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.feed.vote'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.vote', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.vote', ...params },
      { headers },
    )
  }
}

export class GraphNS {
  _service: ServiceClient
  assertion: AssertionRecord
  confirmation: ConfirmationRecord
  follow: FollowRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.assertion = new AssertionRecord(service)
    this.confirmation = new ConfirmationRecord(service)
    this.follow = new FollowRecord(service)
  }

  getFollowers(
    params?: AppBskyGraphGetFollowers.QueryParams,
    opts?: AppBskyGraphGetFollowers.CallOptions,
  ): Promise<AppBskyGraphGetFollowers.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollowers', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollowers.toKnownErr(e)
      })
  }

  getFollows(
    params?: AppBskyGraphGetFollows.QueryParams,
    opts?: AppBskyGraphGetFollows.CallOptions,
  ): Promise<AppBskyGraphGetFollows.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollows', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollows.toKnownErr(e)
      })
  }

  getMutes(
    params?: AppBskyGraphGetMutes.QueryParams,
    opts?: AppBskyGraphGetMutes.CallOptions,
  ): Promise<AppBskyGraphGetMutes.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getMutes', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetMutes.toKnownErr(e)
      })
  }

  mute(
    data?: AppBskyGraphMute.InputSchema,
    opts?: AppBskyGraphMute.CallOptions,
  ): Promise<AppBskyGraphMute.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.mute', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphMute.toKnownErr(e)
      })
  }

  unmute(
    data?: AppBskyGraphUnmute.InputSchema,
    opts?: AppBskyGraphUnmute.CallOptions,
  ): Promise<AppBskyGraphUnmute.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.unmute', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyGraphUnmute.toKnownErr(e)
      })
  }
}

export class AssertionRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphAssertion.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.assertion',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyGraphAssertion.Record
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.assertion',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphAssertion.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.assertion'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.assertion', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.assertion', ...params },
      { headers },
    )
  }
}

export class ConfirmationRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphConfirmation.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.confirmation',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyGraphConfirmation.Record
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.confirmation',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphConfirmation.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.confirmation'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.confirmation', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.confirmation', ...params },
      { headers },
    )
  }
}

export class FollowRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyGraphFollow.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AppBskyGraphFollow.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyGraphFollow.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.graph.follow'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params },
      { headers },
    )
  }
}

export class NotificationNS {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  getCount(
    params?: AppBskyNotificationGetCount.QueryParams,
    opts?: AppBskyNotificationGetCount.CallOptions,
  ): Promise<AppBskyNotificationGetCount.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.getCount', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationGetCount.toKnownErr(e)
      })
  }

  list(
    params?: AppBskyNotificationList.QueryParams,
    opts?: AppBskyNotificationList.CallOptions,
  ): Promise<AppBskyNotificationList.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.list', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationList.toKnownErr(e)
      })
  }

  updateSeen(
    data?: AppBskyNotificationUpdateSeen.InputSchema,
    opts?: AppBskyNotificationUpdateSeen.CallOptions,
  ): Promise<AppBskyNotificationUpdateSeen.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.updateSeen', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyNotificationUpdateSeen.toKnownErr(e)
      })
  }
}

export class SystemNS {
  _service: ServiceClient
  declaration: DeclarationRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.declaration = new DeclarationRecord(service)
  }
}

export class DeclarationRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskySystemDeclaration.Record }[]
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.system.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskySystemDeclaration.Record
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.system.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskySystemDeclaration.Record,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    record.$type = 'app.bsky.system.declaration'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.system.declaration', ...params, record },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.system.declaration', ...params },
      { headers },
    )
  }
}
