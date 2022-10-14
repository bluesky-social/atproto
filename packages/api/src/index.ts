/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
} from '@adxp/xrpc'
import { methodSchemas, recordSchemas } from './schemas'
import * as ComAtprotoCreateAccount from './types/com/atproto/createAccount'
import * as ComAtprotoCreateInviteCode from './types/com/atproto/createInviteCode'
import * as ComAtprotoCreateSession from './types/com/atproto/createSession'
import * as ComAtprotoDeleteAccount from './types/com/atproto/deleteAccount'
import * as ComAtprotoDeleteSession from './types/com/atproto/deleteSession'
import * as ComAtprotoGetAccount from './types/com/atproto/getAccount'
import * as ComAtprotoGetAccountsConfig from './types/com/atproto/getAccountsConfig'
import * as ComAtprotoGetSession from './types/com/atproto/getSession'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repoBatchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repoCreateRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repoDeleteRecord'
import * as ComAtprotoRepoDescribe from './types/com/atproto/repoDescribe'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repoGetRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repoListRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repoPutRecord'
import * as ComAtprotoRequestAccountPasswordReset from './types/com/atproto/requestAccountPasswordReset'
import * as ComAtprotoResetAccountPassword from './types/com/atproto/resetAccountPassword'
import * as ComAtprotoResolveName from './types/com/atproto/resolveName'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/syncGetRepo'
import * as ComAtprotoSyncGetRoot from './types/com/atproto/syncGetRoot'
import * as ComAtprotoSyncUpdateRepo from './types/com/atproto/syncUpdateRepo'
import * as AppBskyBadge from './types/app/bsky/badge'
import * as AppBskyFollow from './types/app/bsky/follow'
import * as AppBskyGetAuthorFeed from './types/app/bsky/getAuthorFeed'
import * as AppBskyGetHomeFeed from './types/app/bsky/getHomeFeed'
import * as AppBskyGetLikedBy from './types/app/bsky/getLikedBy'
import * as AppBskyGetNotificationCount from './types/app/bsky/getNotificationCount'
import * as AppBskyGetNotifications from './types/app/bsky/getNotifications'
import * as AppBskyGetPostThread from './types/app/bsky/getPostThread'
import * as AppBskyGetProfile from './types/app/bsky/getProfile'
import * as AppBskyGetRepostedBy from './types/app/bsky/getRepostedBy'
import * as AppBskyGetUserFollowers from './types/app/bsky/getUserFollowers'
import * as AppBskyGetUserFollows from './types/app/bsky/getUserFollows'
import * as AppBskyGetUsersSearch from './types/app/bsky/getUsersSearch'
import * as AppBskyGetUsersTypeahead from './types/app/bsky/getUsersTypeahead'
import * as AppBskyLike from './types/app/bsky/like'
import * as AppBskyMediaEmbed from './types/app/bsky/mediaEmbed'
import * as AppBskyPost from './types/app/bsky/post'
import * as AppBskyPostNotificationsSeen from './types/app/bsky/postNotificationsSeen'
import * as AppBskyProfile from './types/app/bsky/profile'
import * as AppBskyRepost from './types/app/bsky/repost'

export * as ComAtprotoCreateAccount from './types/com/atproto/createAccount'
export * as ComAtprotoCreateInviteCode from './types/com/atproto/createInviteCode'
export * as ComAtprotoCreateSession from './types/com/atproto/createSession'
export * as ComAtprotoDeleteAccount from './types/com/atproto/deleteAccount'
export * as ComAtprotoDeleteSession from './types/com/atproto/deleteSession'
export * as ComAtprotoGetAccount from './types/com/atproto/getAccount'
export * as ComAtprotoGetAccountsConfig from './types/com/atproto/getAccountsConfig'
export * as ComAtprotoGetSession from './types/com/atproto/getSession'
export * as ComAtprotoRepoBatchWrite from './types/com/atproto/repoBatchWrite'
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repoCreateRecord'
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repoDeleteRecord'
export * as ComAtprotoRepoDescribe from './types/com/atproto/repoDescribe'
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repoGetRecord'
export * as ComAtprotoRepoListRecords from './types/com/atproto/repoListRecords'
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repoPutRecord'
export * as ComAtprotoRequestAccountPasswordReset from './types/com/atproto/requestAccountPasswordReset'
export * as ComAtprotoResetAccountPassword from './types/com/atproto/resetAccountPassword'
export * as ComAtprotoResolveName from './types/com/atproto/resolveName'
export * as ComAtprotoSyncGetRepo from './types/com/atproto/syncGetRepo'
export * as ComAtprotoSyncGetRoot from './types/com/atproto/syncGetRoot'
export * as ComAtprotoSyncUpdateRepo from './types/com/atproto/syncUpdateRepo'
export * as AppBskyBadge from './types/app/bsky/badge'
export * as AppBskyFollow from './types/app/bsky/follow'
export * as AppBskyGetAuthorFeed from './types/app/bsky/getAuthorFeed'
export * as AppBskyGetHomeFeed from './types/app/bsky/getHomeFeed'
export * as AppBskyGetLikedBy from './types/app/bsky/getLikedBy'
export * as AppBskyGetNotificationCount from './types/app/bsky/getNotificationCount'
export * as AppBskyGetNotifications from './types/app/bsky/getNotifications'
export * as AppBskyGetPostThread from './types/app/bsky/getPostThread'
export * as AppBskyGetProfile from './types/app/bsky/getProfile'
export * as AppBskyGetRepostedBy from './types/app/bsky/getRepostedBy'
export * as AppBskyGetUserFollowers from './types/app/bsky/getUserFollowers'
export * as AppBskyGetUserFollows from './types/app/bsky/getUserFollows'
export * as AppBskyGetUsersSearch from './types/app/bsky/getUsersSearch'
export * as AppBskyGetUsersTypeahead from './types/app/bsky/getUsersTypeahead'
export * as AppBskyLike from './types/app/bsky/like'
export * as AppBskyMediaEmbed from './types/app/bsky/mediaEmbed'
export * as AppBskyPost from './types/app/bsky/post'
export * as AppBskyPostNotificationsSeen from './types/app/bsky/postNotificationsSeen'
export * as AppBskyProfile from './types/app/bsky/profile'
export * as AppBskyRepost from './types/app/bsky/repost'

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

  constructor(service: ServiceClient) {
    this._service = service
  }

  createAccount(
    params: ComAtprotoCreateAccount.QueryParams,
    data?: ComAtprotoCreateAccount.InputSchema,
    opts?: ComAtprotoCreateAccount.CallOptions
  ): Promise<ComAtprotoCreateAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.createAccount', params, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateAccount.toKnownErr(e)
      })
  }

  createInviteCode(
    params: ComAtprotoCreateInviteCode.QueryParams,
    data?: ComAtprotoCreateInviteCode.InputSchema,
    opts?: ComAtprotoCreateInviteCode.CallOptions
  ): Promise<ComAtprotoCreateInviteCode.Response> {
    return this._service.xrpc
      .call('com.atproto.createInviteCode', params, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateInviteCode.toKnownErr(e)
      })
  }

  createSession(
    params: ComAtprotoCreateSession.QueryParams,
    data?: ComAtprotoCreateSession.InputSchema,
    opts?: ComAtprotoCreateSession.CallOptions
  ): Promise<ComAtprotoCreateSession.Response> {
    return this._service.xrpc
      .call('com.atproto.createSession', params, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateSession.toKnownErr(e)
      })
  }

  deleteAccount(
    params: ComAtprotoDeleteAccount.QueryParams,
    data?: ComAtprotoDeleteAccount.InputSchema,
    opts?: ComAtprotoDeleteAccount.CallOptions
  ): Promise<ComAtprotoDeleteAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.deleteAccount', params, data, opts)
      .catch((e) => {
        throw ComAtprotoDeleteAccount.toKnownErr(e)
      })
  }

  deleteSession(
    params: ComAtprotoDeleteSession.QueryParams,
    data?: ComAtprotoDeleteSession.InputSchema,
    opts?: ComAtprotoDeleteSession.CallOptions
  ): Promise<ComAtprotoDeleteSession.Response> {
    return this._service.xrpc
      .call('com.atproto.deleteSession', params, data, opts)
      .catch((e) => {
        throw ComAtprotoDeleteSession.toKnownErr(e)
      })
  }

  getAccount(
    params: ComAtprotoGetAccount.QueryParams,
    data?: ComAtprotoGetAccount.InputSchema,
    opts?: ComAtprotoGetAccount.CallOptions
  ): Promise<ComAtprotoGetAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.getAccount', params, data, opts)
      .catch((e) => {
        throw ComAtprotoGetAccount.toKnownErr(e)
      })
  }

  getAccountsConfig(
    params: ComAtprotoGetAccountsConfig.QueryParams,
    data?: ComAtprotoGetAccountsConfig.InputSchema,
    opts?: ComAtprotoGetAccountsConfig.CallOptions
  ): Promise<ComAtprotoGetAccountsConfig.Response> {
    return this._service.xrpc
      .call('com.atproto.getAccountsConfig', params, data, opts)
      .catch((e) => {
        throw ComAtprotoGetAccountsConfig.toKnownErr(e)
      })
  }

  getSession(
    params: ComAtprotoGetSession.QueryParams,
    data?: ComAtprotoGetSession.InputSchema,
    opts?: ComAtprotoGetSession.CallOptions
  ): Promise<ComAtprotoGetSession.Response> {
    return this._service.xrpc
      .call('com.atproto.getSession', params, data, opts)
      .catch((e) => {
        throw ComAtprotoGetSession.toKnownErr(e)
      })
  }

  repoBatchWrite(
    params: ComAtprotoRepoBatchWrite.QueryParams,
    data?: ComAtprotoRepoBatchWrite.InputSchema,
    opts?: ComAtprotoRepoBatchWrite.CallOptions
  ): Promise<ComAtprotoRepoBatchWrite.Response> {
    return this._service.xrpc
      .call('com.atproto.repoBatchWrite', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoBatchWrite.toKnownErr(e)
      })
  }

  repoCreateRecord(
    params: ComAtprotoRepoCreateRecord.QueryParams,
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoCreateRecord', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  repoDeleteRecord(
    params: ComAtprotoRepoDeleteRecord.QueryParams,
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoDeleteRecord', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  repoDescribe(
    params: ComAtprotoRepoDescribe.QueryParams,
    data?: ComAtprotoRepoDescribe.InputSchema,
    opts?: ComAtprotoRepoDescribe.CallOptions
  ): Promise<ComAtprotoRepoDescribe.Response> {
    return this._service.xrpc
      .call('com.atproto.repoDescribe', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDescribe.toKnownErr(e)
      })
  }

  repoGetRecord(
    params: ComAtprotoRepoGetRecord.QueryParams,
    data?: ComAtprotoRepoGetRecord.InputSchema,
    opts?: ComAtprotoRepoGetRecord.CallOptions
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoGetRecord', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  repoListRecords(
    params: ComAtprotoRepoListRecords.QueryParams,
    data?: ComAtprotoRepoListRecords.InputSchema,
    opts?: ComAtprotoRepoListRecords.CallOptions
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._service.xrpc
      .call('com.atproto.repoListRecords', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoListRecords.toKnownErr(e)
      })
  }

  repoPutRecord(
    params: ComAtprotoRepoPutRecord.QueryParams,
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoPutRecord', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
      })
  }

  requestAccountPasswordReset(
    params: ComAtprotoRequestAccountPasswordReset.QueryParams,
    data?: ComAtprotoRequestAccountPasswordReset.InputSchema,
    opts?: ComAtprotoRequestAccountPasswordReset.CallOptions
  ): Promise<ComAtprotoRequestAccountPasswordReset.Response> {
    return this._service.xrpc
      .call('com.atproto.requestAccountPasswordReset', params, data, opts)
      .catch((e) => {
        throw ComAtprotoRequestAccountPasswordReset.toKnownErr(e)
      })
  }

  resetAccountPassword(
    params: ComAtprotoResetAccountPassword.QueryParams,
    data?: ComAtprotoResetAccountPassword.InputSchema,
    opts?: ComAtprotoResetAccountPassword.CallOptions
  ): Promise<ComAtprotoResetAccountPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.resetAccountPassword', params, data, opts)
      .catch((e) => {
        throw ComAtprotoResetAccountPassword.toKnownErr(e)
      })
  }

  resolveName(
    params: ComAtprotoResolveName.QueryParams,
    data?: ComAtprotoResolveName.InputSchema,
    opts?: ComAtprotoResolveName.CallOptions
  ): Promise<ComAtprotoResolveName.Response> {
    return this._service.xrpc
      .call('com.atproto.resolveName', params, data, opts)
      .catch((e) => {
        throw ComAtprotoResolveName.toKnownErr(e)
      })
  }

  syncGetRepo(
    params: ComAtprotoSyncGetRepo.QueryParams,
    data?: ComAtprotoSyncGetRepo.InputSchema,
    opts?: ComAtprotoSyncGetRepo.CallOptions
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.syncGetRepo', params, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }

  syncGetRoot(
    params: ComAtprotoSyncGetRoot.QueryParams,
    data?: ComAtprotoSyncGetRoot.InputSchema,
    opts?: ComAtprotoSyncGetRoot.CallOptions
  ): Promise<ComAtprotoSyncGetRoot.Response> {
    return this._service.xrpc
      .call('com.atproto.syncGetRoot', params, data, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRoot.toKnownErr(e)
      })
  }

  syncUpdateRepo(
    params: ComAtprotoSyncUpdateRepo.QueryParams,
    data?: ComAtprotoSyncUpdateRepo.InputSchema,
    opts?: ComAtprotoSyncUpdateRepo.CallOptions
  ): Promise<ComAtprotoSyncUpdateRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.syncUpdateRepo', params, data, opts)
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
  badge: BadgeRecord
  follow: FollowRecord
  like: LikeRecord
  mediaEmbed: MediaEmbedRecord
  post: PostRecord
  profile: ProfileRecord
  repost: RepostRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.badge = new BadgeRecord(service)
    this.follow = new FollowRecord(service)
    this.like = new LikeRecord(service)
    this.mediaEmbed = new MediaEmbedRecord(service)
    this.post = new PostRecord(service)
    this.profile = new ProfileRecord(service)
    this.repost = new RepostRecord(service)
  }

  getAuthorFeed(
    params: AppBskyGetAuthorFeed.QueryParams,
    data?: AppBskyGetAuthorFeed.InputSchema,
    opts?: AppBskyGetAuthorFeed.CallOptions
  ): Promise<AppBskyGetAuthorFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.getAuthorFeed', params, data, opts)
      .catch((e) => {
        throw AppBskyGetAuthorFeed.toKnownErr(e)
      })
  }

  getHomeFeed(
    params: AppBskyGetHomeFeed.QueryParams,
    data?: AppBskyGetHomeFeed.InputSchema,
    opts?: AppBskyGetHomeFeed.CallOptions
  ): Promise<AppBskyGetHomeFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.getHomeFeed', params, data, opts)
      .catch((e) => {
        throw AppBskyGetHomeFeed.toKnownErr(e)
      })
  }

  getLikedBy(
    params: AppBskyGetLikedBy.QueryParams,
    data?: AppBskyGetLikedBy.InputSchema,
    opts?: AppBskyGetLikedBy.CallOptions
  ): Promise<AppBskyGetLikedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.getLikedBy', params, data, opts)
      .catch((e) => {
        throw AppBskyGetLikedBy.toKnownErr(e)
      })
  }

  getNotificationCount(
    params: AppBskyGetNotificationCount.QueryParams,
    data?: AppBskyGetNotificationCount.InputSchema,
    opts?: AppBskyGetNotificationCount.CallOptions
  ): Promise<AppBskyGetNotificationCount.Response> {
    return this._service.xrpc
      .call('app.bsky.getNotificationCount', params, data, opts)
      .catch((e) => {
        throw AppBskyGetNotificationCount.toKnownErr(e)
      })
  }

  getNotifications(
    params: AppBskyGetNotifications.QueryParams,
    data?: AppBskyGetNotifications.InputSchema,
    opts?: AppBskyGetNotifications.CallOptions
  ): Promise<AppBskyGetNotifications.Response> {
    return this._service.xrpc
      .call('app.bsky.getNotifications', params, data, opts)
      .catch((e) => {
        throw AppBskyGetNotifications.toKnownErr(e)
      })
  }

  getPostThread(
    params: AppBskyGetPostThread.QueryParams,
    data?: AppBskyGetPostThread.InputSchema,
    opts?: AppBskyGetPostThread.CallOptions
  ): Promise<AppBskyGetPostThread.Response> {
    return this._service.xrpc
      .call('app.bsky.getPostThread', params, data, opts)
      .catch((e) => {
        throw AppBskyGetPostThread.toKnownErr(e)
      })
  }

  getProfile(
    params: AppBskyGetProfile.QueryParams,
    data?: AppBskyGetProfile.InputSchema,
    opts?: AppBskyGetProfile.CallOptions
  ): Promise<AppBskyGetProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.getProfile', params, data, opts)
      .catch((e) => {
        throw AppBskyGetProfile.toKnownErr(e)
      })
  }

  getRepostedBy(
    params: AppBskyGetRepostedBy.QueryParams,
    data?: AppBskyGetRepostedBy.InputSchema,
    opts?: AppBskyGetRepostedBy.CallOptions
  ): Promise<AppBskyGetRepostedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.getRepostedBy', params, data, opts)
      .catch((e) => {
        throw AppBskyGetRepostedBy.toKnownErr(e)
      })
  }

  getUserFollowers(
    params: AppBskyGetUserFollowers.QueryParams,
    data?: AppBskyGetUserFollowers.InputSchema,
    opts?: AppBskyGetUserFollowers.CallOptions
  ): Promise<AppBskyGetUserFollowers.Response> {
    return this._service.xrpc
      .call('app.bsky.getUserFollowers', params, data, opts)
      .catch((e) => {
        throw AppBskyGetUserFollowers.toKnownErr(e)
      })
  }

  getUserFollows(
    params: AppBskyGetUserFollows.QueryParams,
    data?: AppBskyGetUserFollows.InputSchema,
    opts?: AppBskyGetUserFollows.CallOptions
  ): Promise<AppBskyGetUserFollows.Response> {
    return this._service.xrpc
      .call('app.bsky.getUserFollows', params, data, opts)
      .catch((e) => {
        throw AppBskyGetUserFollows.toKnownErr(e)
      })
  }

  getUsersSearch(
    params: AppBskyGetUsersSearch.QueryParams,
    data?: AppBskyGetUsersSearch.InputSchema,
    opts?: AppBskyGetUsersSearch.CallOptions
  ): Promise<AppBskyGetUsersSearch.Response> {
    return this._service.xrpc
      .call('app.bsky.getUsersSearch', params, data, opts)
      .catch((e) => {
        throw AppBskyGetUsersSearch.toKnownErr(e)
      })
  }

  getUsersTypeahead(
    params: AppBskyGetUsersTypeahead.QueryParams,
    data?: AppBskyGetUsersTypeahead.InputSchema,
    opts?: AppBskyGetUsersTypeahead.CallOptions
  ): Promise<AppBskyGetUsersTypeahead.Response> {
    return this._service.xrpc
      .call('app.bsky.getUsersTypeahead', params, data, opts)
      .catch((e) => {
        throw AppBskyGetUsersTypeahead.toKnownErr(e)
      })
  }

  postNotificationsSeen(
    params: AppBskyPostNotificationsSeen.QueryParams,
    data?: AppBskyPostNotificationsSeen.InputSchema,
    opts?: AppBskyPostNotificationsSeen.CallOptions
  ): Promise<AppBskyPostNotificationsSeen.Response> {
    return this._service.xrpc
      .call('app.bsky.postNotificationsSeen', params, data, opts)
      .catch((e) => {
        throw AppBskyPostNotificationsSeen.toKnownErr(e)
      })
  }
}

export class BadgeRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{ records: { uri: string, value: AppBskyBadge.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.badge',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyBadge.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.badge',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyBadge.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.badge'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.badge', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.badge', ...params },
      undefined,
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
  ): Promise<{ records: { uri: string, value: AppBskyFollow.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.follow',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyFollow.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.follow',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyFollow.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.follow'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.follow', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.follow', ...params },
      undefined,
      { headers }
    )
  }
}

export class LikeRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{ records: { uri: string, value: AppBskyLike.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.like',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyLike.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.like',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyLike.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.like'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.like', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.like', ...params },
      undefined,
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
  ): Promise<{ records: { uri: string, value: AppBskyMediaEmbed.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.mediaEmbed',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyMediaEmbed.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.mediaEmbed',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyMediaEmbed.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.mediaEmbed'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.mediaEmbed', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.mediaEmbed', ...params },
      undefined,
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
  ): Promise<{ records: { uri: string, value: AppBskyPost.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.post',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyPost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.post',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyPost.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.post'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.post', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.post', ...params },
      undefined,
      { headers }
    )
  }
}

export class ProfileRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{ records: { uri: string, value: AppBskyProfile.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.profile',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyProfile.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.profile',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyProfile.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.profile'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.profile', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.profile', ...params },
      undefined,
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
  ): Promise<{ records: { uri: string, value: AppBskyRepost.Record }[] }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.repost',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyRepost.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.repost',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<ComAtprotoRepoCreateRecord.QueryParams, 'collection'>,
    record: AppBskyRepost.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.repost'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      { collection: 'app.bsky.repost', ...params },
      record,
      { encoding: 'application/json', headers }
    )
    return res.data
  }

  async delete(
    params: Omit<ComAtprotoRepoDeleteRecord.QueryParams, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._service.xrpc.call(
      'com.atproto.repoDeleteRecord',
      { collection: 'app.bsky.repost', ...params },
      undefined,
      { headers }
    )
  }
}
