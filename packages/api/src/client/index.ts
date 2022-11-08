/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
} from '@atproto/xrpc'
import { methodSchemas, recordSchemas } from './schemas'
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
import * as AppBskyActorCreateScene from './types/app/bsky/actor/createScene'
import * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
import * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
import * as AppBskyActorProfile from './types/app/bsky/actor/profile'
import * as AppBskyActorSearch from './types/app/bsky/actor/search'
import * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
import * as AppBskyFeedGetLikedBy from './types/app/bsky/feed/getLikedBy'
import * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
import * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
import * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
import * as AppBskyFeedLike from './types/app/bsky/feed/like'
import * as AppBskyFeedMediaEmbed from './types/app/bsky/feed/mediaEmbed'
import * as AppBskyFeedPost from './types/app/bsky/feed/post'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
import * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
import * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
import * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
import * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationList from './types/app/bsky/notification/list'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskySystemDeclaration from './types/app/bsky/system/declaration'

export * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
export * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
export * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
export * as ComAtprotoAccountGet from './types/com/atproto/account/get'
export * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
export * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
export * as ComAtprotoHandleResolve from './types/com/atproto/handle/resolve'
export * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
export * as ComAtprotoRepoDescribe from './types/com/atproto/repo/describe'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
export * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
export * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
export * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
export * as ComAtprotoSessionGet from './types/com/atproto/session/get'
export * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
export * as ComAtprotoSyncGetRepo from './types/com/atproto/sync/getRepo'
export * as ComAtprotoSyncGetRoot from './types/com/atproto/sync/getRoot'
export * as ComAtprotoSyncUpdateRepo from './types/com/atproto/sync/updateRepo'
export * as AppBskyActorCreateScene from './types/app/bsky/actor/createScene'
export * as AppBskyActorGetProfile from './types/app/bsky/actor/getProfile'
export * as AppBskyActorGetSuggestions from './types/app/bsky/actor/getSuggestions'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile'
export * as AppBskyActorSearch from './types/app/bsky/actor/search'
export * as AppBskyActorSearchTypeahead from './types/app/bsky/actor/searchTypeahead'
export * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
export * as AppBskyFeedGetAuthorFeed from './types/app/bsky/feed/getAuthorFeed'
export * as AppBskyFeedGetLikedBy from './types/app/bsky/feed/getLikedBy'
export * as AppBskyFeedGetPostThread from './types/app/bsky/feed/getPostThread'
export * as AppBskyFeedGetRepostedBy from './types/app/bsky/feed/getRepostedBy'
export * as AppBskyFeedGetTimeline from './types/app/bsky/feed/getTimeline'
export * as AppBskyFeedLike from './types/app/bsky/feed/like'
export * as AppBskyFeedMediaEmbed from './types/app/bsky/feed/mediaEmbed'
export * as AppBskyFeedPost from './types/app/bsky/feed/post'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
export * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
export * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
export * as AppBskyGraphGetFollowers from './types/app/bsky/graph/getFollowers'
export * as AppBskyGraphGetFollows from './types/app/bsky/graph/getFollows'
export * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
export * as AppBskyNotificationList from './types/app/bsky/notification/list'
export * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
export * as AppBskySystemDeclaration from './types/app/bsky/system/declaration'

export const APP_BSKY_GRAPH = {
  AssertCreator: 'app.bsky.graph.assertCreator',
  AssertMember: 'app.bsky.graph.assertMember',
}
export const APP_BSKY_SYSTEM = {
  ActorScene: 'app.bsky.system.actorScene',
  ActorUser: 'app.bsky.system.actorUser',
}

export class Client {
  xrpc: XrpcClient = new XrpcClient()

  constructor() {
    this.xrpc.addSchemas(methodSchemas)
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
  handle: HandleNS
  repo: RepoNS
  server: ServerNS
  session: SessionNS
  sync: SyncNS

  constructor(service: ServiceClient) {
    this._service = service
    this.account = new AccountNS(service)
    this.handle = new HandleNS(service)
    this.repo = new RepoNS(service)
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
    opts?: ComAtprotoAccountCreate.CallOptions
  ): Promise<ComAtprotoAccountCreate.Response> {
    return this._service.xrpc
      .call('com.atproto.account.create', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountCreate.toKnownErr(e)
      })
  }

  createInviteCode(
    data?: ComAtprotoAccountCreateInviteCode.InputSchema,
    opts?: ComAtprotoAccountCreateInviteCode.CallOptions
  ): Promise<ComAtprotoAccountCreateInviteCode.Response> {
    return this._service.xrpc
      .call('com.atproto.account.createInviteCode', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountCreateInviteCode.toKnownErr(e)
      })
  }

  delete(
    data?: ComAtprotoAccountDelete.InputSchema,
    opts?: ComAtprotoAccountDelete.CallOptions
  ): Promise<ComAtprotoAccountDelete.Response> {
    return this._service.xrpc
      .call('com.atproto.account.delete', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountDelete.toKnownErr(e)
      })
  }

  get(
    params?: ComAtprotoAccountGet.QueryParams,
    opts?: ComAtprotoAccountGet.CallOptions
  ): Promise<ComAtprotoAccountGet.Response> {
    return this._service.xrpc
      .call('com.atproto.account.get', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoAccountGet.toKnownErr(e)
      })
  }

  requestPasswordReset(
    data?: ComAtprotoAccountRequestPasswordReset.InputSchema,
    opts?: ComAtprotoAccountRequestPasswordReset.CallOptions
  ): Promise<ComAtprotoAccountRequestPasswordReset.Response> {
    return this._service.xrpc
      .call('com.atproto.account.requestPasswordReset', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountRequestPasswordReset.toKnownErr(e)
      })
  }

  resetPassword(
    data?: ComAtprotoAccountResetPassword.InputSchema,
    opts?: ComAtprotoAccountResetPassword.CallOptions
  ): Promise<ComAtprotoAccountResetPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.account.resetPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoAccountResetPassword.toKnownErr(e)
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
    opts?: ComAtprotoHandleResolve.CallOptions
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
    opts?: ComAtprotoRepoBatchWrite.CallOptions
  ): Promise<ComAtprotoRepoBatchWrite.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.batchWrite', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoBatchWrite.toKnownErr(e)
      })
  }

  createRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.createRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  deleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.deleteRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  describe(
    params?: ComAtprotoRepoDescribe.QueryParams,
    opts?: ComAtprotoRepoDescribe.CallOptions
  ): Promise<ComAtprotoRepoDescribe.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.describe', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoDescribe.toKnownErr(e)
      })
  }

  getRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  listRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.listRecords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoListRecords.toKnownErr(e)
      })
  }

  putRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repo.putRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
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
    opts?: ComAtprotoServerGetAccountsConfig.CallOptions
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
    opts?: ComAtprotoSessionCreate.CallOptions
  ): Promise<ComAtprotoSessionCreate.Response> {
    return this._service.xrpc
      .call('com.atproto.session.create', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSessionCreate.toKnownErr(e)
      })
  }

  delete(
    data?: ComAtprotoSessionDelete.InputSchema,
    opts?: ComAtprotoSessionDelete.CallOptions
  ): Promise<ComAtprotoSessionDelete.Response> {
    return this._service.xrpc
      .call('com.atproto.session.delete', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSessionDelete.toKnownErr(e)
      })
  }

  get(
    params?: ComAtprotoSessionGet.QueryParams,
    opts?: ComAtprotoSessionGet.CallOptions
  ): Promise<ComAtprotoSessionGet.Response> {
    return this._service.xrpc
      .call('com.atproto.session.get', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSessionGet.toKnownErr(e)
      })
  }

  refresh(
    data?: ComAtprotoSessionRefresh.InputSchema,
    opts?: ComAtprotoSessionRefresh.CallOptions
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

  getRepo(
    params?: ComAtprotoSyncGetRepo.QueryParams,
    opts?: ComAtprotoSyncGetRepo.CallOptions
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }

  getRoot(
    params?: ComAtprotoSyncGetRoot.QueryParams,
    opts?: ComAtprotoSyncGetRoot.CallOptions
  ): Promise<ComAtprotoSyncGetRoot.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.getRoot', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRoot.toKnownErr(e)
      })
  }

  updateRepo(
    data?: ComAtprotoSyncUpdateRepo.InputSchema,
    opts?: ComAtprotoSyncUpdateRepo.CallOptions
  ): Promise<ComAtprotoSyncUpdateRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.sync.updateRepo', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncUpdateRepo.toKnownErr(e)
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
  feed: FeedNS
  graph: GraphNS
  notification: NotificationNS
  system: SystemNS

  constructor(service: ServiceClient) {
    this._service = service
    this.actor = new ActorNS(service)
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

  createScene(
    data?: AppBskyActorCreateScene.InputSchema,
    opts?: AppBskyActorCreateScene.CallOptions
  ): Promise<AppBskyActorCreateScene.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.createScene', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyActorCreateScene.toKnownErr(e)
      })
  }

  getProfile(
    params?: AppBskyActorGetProfile.QueryParams,
    opts?: AppBskyActorGetProfile.CallOptions
  ): Promise<AppBskyActorGetProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getProfile', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetProfile.toKnownErr(e)
      })
  }

  getSuggestions(
    params?: AppBskyActorGetSuggestions.QueryParams,
    opts?: AppBskyActorGetSuggestions.CallOptions
  ): Promise<AppBskyActorGetSuggestions.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.getSuggestions', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorGetSuggestions.toKnownErr(e)
      })
  }

  search(
    params?: AppBskyActorSearch.QueryParams,
    opts?: AppBskyActorSearch.CallOptions
  ): Promise<AppBskyActorSearch.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.search', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearch.toKnownErr(e)
      })
  }

  searchTypeahead(
    params?: AppBskyActorSearchTypeahead.QueryParams,
    opts?: AppBskyActorSearchTypeahead.CallOptions
  ): Promise<AppBskyActorSearchTypeahead.Response> {
    return this._service.xrpc
      .call('app.bsky.actor.searchTypeahead', params, undefined, opts)
      .catch((e) => {
        throw AppBskyActorSearchTypeahead.toKnownErr(e)
      })
  }

  updateProfile(
    data?: AppBskyActorUpdateProfile.InputSchema,
    opts?: AppBskyActorUpdateProfile.CallOptions
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
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyActorProfile.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.actor.profile',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyActorProfile.Record }> {
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.actor.profile'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.actor.profile', ...params },
      { headers }
    )
  }
}

export class FeedNS {
  _service: ServiceClient
  like: LikeRecord
  mediaEmbed: MediaEmbedRecord
  post: PostRecord
  repost: RepostRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.like = new LikeRecord(service)
    this.mediaEmbed = new MediaEmbedRecord(service)
    this.post = new PostRecord(service)
    this.repost = new RepostRecord(service)
  }

  getAuthorFeed(
    params?: AppBskyFeedGetAuthorFeed.QueryParams,
    opts?: AppBskyFeedGetAuthorFeed.CallOptions
  ): Promise<AppBskyFeedGetAuthorFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getAuthorFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetAuthorFeed.toKnownErr(e)
      })
  }

  getLikedBy(
    params?: AppBskyFeedGetLikedBy.QueryParams,
    opts?: AppBskyFeedGetLikedBy.CallOptions
  ): Promise<AppBskyFeedGetLikedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getLikedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetLikedBy.toKnownErr(e)
      })
  }

  getPostThread(
    params?: AppBskyFeedGetPostThread.QueryParams,
    opts?: AppBskyFeedGetPostThread.CallOptions
  ): Promise<AppBskyFeedGetPostThread.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getPostThread', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetPostThread.toKnownErr(e)
      })
  }

  getRepostedBy(
    params?: AppBskyFeedGetRepostedBy.QueryParams,
    opts?: AppBskyFeedGetRepostedBy.CallOptions
  ): Promise<AppBskyFeedGetRepostedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getRepostedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetRepostedBy.toKnownErr(e)
      })
  }

  getTimeline(
    params?: AppBskyFeedGetTimeline.QueryParams,
    opts?: AppBskyFeedGetTimeline.CallOptions
  ): Promise<AppBskyFeedGetTimeline.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.getTimeline', params, undefined, opts)
      .catch((e) => {
        throw AppBskyFeedGetTimeline.toKnownErr(e)
      })
  }
}

export class LikeRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedLike.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedLike.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.like',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedLike.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.like'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.like', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.like', ...params },
      { headers }
    )
  }
}

export class MediaEmbedRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedMediaEmbed.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.mediaEmbed',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{
    uri: string,
    cid: string,
    value: AppBskyFeedMediaEmbed.Record,
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.mediaEmbed',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedMediaEmbed.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.mediaEmbed'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.mediaEmbed', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.mediaEmbed', ...params },
      { headers }
    )
  }
}

export class PostRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedPost.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.post',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedPost.Record }> {
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.post'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.post', ...params },
      { headers }
    )
  }
}

export class RepostRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedRepost.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.repost',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedRepost.Record }> {
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.repost'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.feed.repost', ...params },
      { headers }
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
    opts?: AppBskyGraphGetFollowers.CallOptions
  ): Promise<AppBskyGraphGetFollowers.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollowers', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollowers.toKnownErr(e)
      })
  }

  getFollows(
    params?: AppBskyGraphGetFollows.QueryParams,
    opts?: AppBskyGraphGetFollows.CallOptions
  ): Promise<AppBskyGraphGetFollows.Response> {
    return this._service.xrpc
      .call('app.bsky.graph.getFollows', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGraphGetFollows.toKnownErr(e)
      })
  }
}

export class AssertionRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyGraphAssertion.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.assertion',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{
    uri: string,
    cid: string,
    value: AppBskyGraphAssertion.Record,
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.graph.assertion'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.assertion', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.assertion', ...params },
      { headers }
    )
  }
}

export class ConfirmationRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyGraphConfirmation.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.confirmation',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{
    uri: string,
    cid: string,
    value: AppBskyGraphConfirmation.Record,
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.graph.confirmation'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.confirmation', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.confirmation', ...params },
      { headers }
    )
  }
}

export class FollowRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyGraphFollow.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.graph.follow',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyGraphFollow.Record }> {
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.graph.follow'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.graph.follow', ...params },
      { headers }
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
    opts?: AppBskyNotificationGetCount.CallOptions
  ): Promise<AppBskyNotificationGetCount.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.getCount', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationGetCount.toKnownErr(e)
      })
  }

  list(
    params?: AppBskyNotificationList.QueryParams,
    opts?: AppBskyNotificationList.CallOptions
  ): Promise<AppBskyNotificationList.Response> {
    return this._service.xrpc
      .call('app.bsky.notification.list', params, undefined, opts)
      .catch((e) => {
        throw AppBskyNotificationList.toKnownErr(e)
      })
  }

  updateSeen(
    data?: AppBskyNotificationUpdateSeen.InputSchema,
    opts?: AppBskyNotificationUpdateSeen.CallOptions
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
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskySystemDeclaration.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.system.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{
    uri: string,
    cid: string,
    value: AppBskySystemDeclaration.Record,
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.system.declaration'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.system.declaration', ...params, record },
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.system.declaration', ...params },
      { headers }
    )
  }
}
