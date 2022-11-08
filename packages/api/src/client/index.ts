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
import * as AppBskyActorProfile from './types/app/bsky/actor/profile'
import * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
import * as AppBskyFeedMediaEmbed from './types/app/bsky/feed/mediaEmbed'
import * as AppBskyFeedPost from './types/app/bsky/feed/post'
import * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
import * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
import * as AppBskyFeedTrend from './types/app/bsky/feed/trend'
import * as AppBskyFeedTrending from './types/app/bsky/feed/trending'
import * as AppBskyFeedVote from './types/app/bsky/feed/vote'
import * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
import * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
import * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
import * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
import * as AppBskyNotificationUpdateSeen from './types/app/bsky/notification/updateSeen'
import * as AppBskySystemDeclaration from './types/app/bsky/system/declaration'

export * as ComAtprotoAccountCreate from './types/com/atproto/account/create'
export * as ComAtprotoAccountCreateInviteCode from './types/com/atproto/account/createInviteCode'
export * as ComAtprotoAccountDelete from './types/com/atproto/account/delete'
export * as ComAtprotoAccountGet from './types/com/atproto/account/get'
export * as ComAtprotoAccountRequestPasswordReset from './types/com/atproto/account/requestPasswordReset'
export * as ComAtprotoAccountResetPassword from './types/com/atproto/account/resetPassword'
export * as ComAtprotoRepoBatchWrite from './types/com/atproto/repo/batchWrite'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord'
export * as ComAtprotoServerGetAccountsConfig from './types/com/atproto/server/getAccountsConfig'
export * as ComAtprotoSessionCreate from './types/com/atproto/session/create'
export * as ComAtprotoSessionDelete from './types/com/atproto/session/delete'
export * as ComAtprotoSessionGet from './types/com/atproto/session/get'
export * as ComAtprotoSessionRefresh from './types/com/atproto/session/refresh'
export * as AppBskyActorCreateScene from './types/app/bsky/actor/createScene'
export * as AppBskyActorProfile from './types/app/bsky/actor/profile'
export * as AppBskyActorUpdateProfile from './types/app/bsky/actor/updateProfile'
export * as AppBskyFeedMediaEmbed from './types/app/bsky/feed/mediaEmbed'
export * as AppBskyFeedPost from './types/app/bsky/feed/post'
export * as AppBskyFeedRepost from './types/app/bsky/feed/repost'
export * as AppBskyFeedSetVote from './types/app/bsky/feed/setVote'
export * as AppBskyFeedTrend from './types/app/bsky/feed/trend'
export * as AppBskyFeedTrending from './types/app/bsky/feed/trending'
export * as AppBskyFeedVote from './types/app/bsky/feed/vote'
export * as AppBskyGraphAssertion from './types/app/bsky/graph/assertion'
export * as AppBskyGraphConfirmation from './types/app/bsky/graph/confirmation'
export * as AppBskyGraphFollow from './types/app/bsky/graph/follow'
export * as AppBskyNotificationGetCount from './types/app/bsky/notification/getCount'
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
  repo: RepoNS
  server: ServerNS
  session: SessionNS

  constructor(service: ServiceClient) {
    this._service = service
    this.account = new AccountNS(service)
    this.repo = new RepoNS(service)
    this.server = new ServerNS(service)
    this.session = new SessionNS(service)
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
  mediaEmbed: MediaEmbedRecord
  post: PostRecord
  repost: RepostRecord
  trend: TrendRecord
  trending: TrendingRecord
  vote: VoteRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.mediaEmbed = new MediaEmbedRecord(service)
    this.post = new PostRecord(service)
    this.repost = new RepostRecord(service)
    this.trend = new TrendRecord(service)
    this.trending = new TrendingRecord(service)
    this.vote = new VoteRecord(service)
  }

  setVote(
    data?: AppBskyFeedSetVote.InputSchema,
    opts?: AppBskyFeedSetVote.CallOptions
  ): Promise<AppBskyFeedSetVote.Response> {
    return this._service.xrpc
      .call('app.bsky.feed.setVote', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyFeedSetVote.toKnownErr(e)
      })
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

export class TrendRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedTrend.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.trend',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedTrend.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.trend',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedTrend.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.trend'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.trend', ...params, record },
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
      { collection: 'app.bsky.feed.trend', ...params },
      { headers }
    )
  }
}

export class TrendingRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedTrending.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.trending',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedTrending.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.feed.trending',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFeedTrending.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.trending'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.trending', ...params, record },
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
      { collection: 'app.bsky.feed.trending', ...params },
      { headers }
    )
  }
}

export class VoteRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyFeedVote.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.feed.vote',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFeedVote.Record }> {
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
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.feed.vote'
    const res = await this._service.xrpc.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection: 'app.bsky.feed.vote', ...params, record },
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
      { collection: 'app.bsky.feed.vote', ...params },
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
