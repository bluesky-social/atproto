/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  Client as XrpcClient,
  ServiceClient as XrpcServiceClient,
} from '@atproto/xrpc'
import { methodSchemas, recordSchemas } from './schemas'
import * as ComAtprotoCreateAccount from './types/com/atproto/createAccount'
import * as ComAtprotoCreateInviteCode from './types/com/atproto/createInviteCode'
import * as ComAtprotoCreateSession from './types/com/atproto/createSession'
import * as ComAtprotoDeleteAccount from './types/com/atproto/deleteAccount'
import * as ComAtprotoDeleteSession from './types/com/atproto/deleteSession'
import * as ComAtprotoGetAccount from './types/com/atproto/getAccount'
import * as ComAtprotoGetAccountsConfig from './types/com/atproto/getAccountsConfig'
import * as ComAtprotoGetSession from './types/com/atproto/getSession'
import * as ComAtprotoRefreshSession from './types/com/atproto/refreshSession'
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
import * as AppBskyDeclaration from './types/app/bsky/declaration'
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
import * as AppBskyInvite from './types/app/bsky/invite'
import * as AppBskyInviteAccept from './types/app/bsky/inviteAccept'
import * as AppBskyLike from './types/app/bsky/like'
import * as AppBskyMediaEmbed from './types/app/bsky/mediaEmbed'
import * as AppBskyPost from './types/app/bsky/post'
import * as AppBskyPostNotificationsSeen from './types/app/bsky/postNotificationsSeen'
import * as AppBskyProfile from './types/app/bsky/profile'
import * as AppBskyRepost from './types/app/bsky/repost'
import * as AppBskyUpdateProfile from './types/app/bsky/updateProfile'

export * as ComAtprotoCreateAccount from './types/com/atproto/createAccount'
export * as ComAtprotoCreateInviteCode from './types/com/atproto/createInviteCode'
export * as ComAtprotoCreateSession from './types/com/atproto/createSession'
export * as ComAtprotoDeleteAccount from './types/com/atproto/deleteAccount'
export * as ComAtprotoDeleteSession from './types/com/atproto/deleteSession'
export * as ComAtprotoGetAccount from './types/com/atproto/getAccount'
export * as ComAtprotoGetAccountsConfig from './types/com/atproto/getAccountsConfig'
export * as ComAtprotoGetSession from './types/com/atproto/getSession'
export * as ComAtprotoRefreshSession from './types/com/atproto/refreshSession'
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
export * as AppBskyDeclaration from './types/app/bsky/declaration'
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
export * as AppBskyInvite from './types/app/bsky/invite'
export * as AppBskyInviteAccept from './types/app/bsky/inviteAccept'
export * as AppBskyLike from './types/app/bsky/like'
export * as AppBskyMediaEmbed from './types/app/bsky/mediaEmbed'
export * as AppBskyPost from './types/app/bsky/post'
export * as AppBskyPostNotificationsSeen from './types/app/bsky/postNotificationsSeen'
export * as AppBskyProfile from './types/app/bsky/profile'
export * as AppBskyRepost from './types/app/bsky/repost'
export * as AppBskyUpdateProfile from './types/app/bsky/updateProfile'

export const APP_BSKY = {
  ActorScene: 'app.bsky.actorScene',
  ActorUser: 'app.bsky.actorUser',
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

  constructor(service: ServiceClient) {
    this._service = service
  }

  createAccount(
    data?: ComAtprotoCreateAccount.InputSchema,
    opts?: ComAtprotoCreateAccount.CallOptions
  ): Promise<ComAtprotoCreateAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.createAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateAccount.toKnownErr(e)
      })
  }

  createInviteCode(
    data?: ComAtprotoCreateInviteCode.InputSchema,
    opts?: ComAtprotoCreateInviteCode.CallOptions
  ): Promise<ComAtprotoCreateInviteCode.Response> {
    return this._service.xrpc
      .call('com.atproto.createInviteCode', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateInviteCode.toKnownErr(e)
      })
  }

  createSession(
    data?: ComAtprotoCreateSession.InputSchema,
    opts?: ComAtprotoCreateSession.CallOptions
  ): Promise<ComAtprotoCreateSession.Response> {
    return this._service.xrpc
      .call('com.atproto.createSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoCreateSession.toKnownErr(e)
      })
  }

  deleteAccount(
    data?: ComAtprotoDeleteAccount.InputSchema,
    opts?: ComAtprotoDeleteAccount.CallOptions
  ): Promise<ComAtprotoDeleteAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.deleteAccount', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoDeleteAccount.toKnownErr(e)
      })
  }

  deleteSession(
    data?: ComAtprotoDeleteSession.InputSchema,
    opts?: ComAtprotoDeleteSession.CallOptions
  ): Promise<ComAtprotoDeleteSession.Response> {
    return this._service.xrpc
      .call('com.atproto.deleteSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoDeleteSession.toKnownErr(e)
      })
  }

  getAccount(
    params?: ComAtprotoGetAccount.QueryParams,
    opts?: ComAtprotoGetAccount.CallOptions
  ): Promise<ComAtprotoGetAccount.Response> {
    return this._service.xrpc
      .call('com.atproto.getAccount', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoGetAccount.toKnownErr(e)
      })
  }

  getAccountsConfig(
    params?: ComAtprotoGetAccountsConfig.QueryParams,
    opts?: ComAtprotoGetAccountsConfig.CallOptions
  ): Promise<ComAtprotoGetAccountsConfig.Response> {
    return this._service.xrpc
      .call('com.atproto.getAccountsConfig', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoGetAccountsConfig.toKnownErr(e)
      })
  }

  getSession(
    params?: ComAtprotoGetSession.QueryParams,
    opts?: ComAtprotoGetSession.CallOptions
  ): Promise<ComAtprotoGetSession.Response> {
    return this._service.xrpc
      .call('com.atproto.getSession', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoGetSession.toKnownErr(e)
      })
  }

  refreshSession(
    data?: ComAtprotoRefreshSession.InputSchema,
    opts?: ComAtprotoRefreshSession.CallOptions
  ): Promise<ComAtprotoRefreshSession.Response> {
    return this._service.xrpc
      .call('com.atproto.refreshSession', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRefreshSession.toKnownErr(e)
      })
  }

  repoBatchWrite(
    data?: ComAtprotoRepoBatchWrite.InputSchema,
    opts?: ComAtprotoRepoBatchWrite.CallOptions
  ): Promise<ComAtprotoRepoBatchWrite.Response> {
    return this._service.xrpc
      .call('com.atproto.repoBatchWrite', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoBatchWrite.toKnownErr(e)
      })
  }

  repoCreateRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoCreateRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoCreateRecord.toKnownErr(e)
      })
  }

  repoDeleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoDeleteRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoDeleteRecord.toKnownErr(e)
      })
  }

  repoDescribe(
    params?: ComAtprotoRepoDescribe.QueryParams,
    opts?: ComAtprotoRepoDescribe.CallOptions
  ): Promise<ComAtprotoRepoDescribe.Response> {
    return this._service.xrpc
      .call('com.atproto.repoDescribe', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoDescribe.toKnownErr(e)
      })
  }

  repoGetRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoGetRecord', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoGetRecord.toKnownErr(e)
      })
  }

  repoListRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._service.xrpc
      .call('com.atproto.repoListRecords', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoRepoListRecords.toKnownErr(e)
      })
  }

  repoPutRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._service.xrpc
      .call('com.atproto.repoPutRecord', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRepoPutRecord.toKnownErr(e)
      })
  }

  requestAccountPasswordReset(
    data?: ComAtprotoRequestAccountPasswordReset.InputSchema,
    opts?: ComAtprotoRequestAccountPasswordReset.CallOptions
  ): Promise<ComAtprotoRequestAccountPasswordReset.Response> {
    return this._service.xrpc
      .call('com.atproto.requestAccountPasswordReset', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoRequestAccountPasswordReset.toKnownErr(e)
      })
  }

  resetAccountPassword(
    data?: ComAtprotoResetAccountPassword.InputSchema,
    opts?: ComAtprotoResetAccountPassword.CallOptions
  ): Promise<ComAtprotoResetAccountPassword.Response> {
    return this._service.xrpc
      .call('com.atproto.resetAccountPassword', opts?.qp, data, opts)
      .catch((e) => {
        throw ComAtprotoResetAccountPassword.toKnownErr(e)
      })
  }

  resolveName(
    params?: ComAtprotoResolveName.QueryParams,
    opts?: ComAtprotoResolveName.CallOptions
  ): Promise<ComAtprotoResolveName.Response> {
    return this._service.xrpc
      .call('com.atproto.resolveName', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoResolveName.toKnownErr(e)
      })
  }

  syncGetRepo(
    params?: ComAtprotoSyncGetRepo.QueryParams,
    opts?: ComAtprotoSyncGetRepo.CallOptions
  ): Promise<ComAtprotoSyncGetRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.syncGetRepo', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRepo.toKnownErr(e)
      })
  }

  syncGetRoot(
    params?: ComAtprotoSyncGetRoot.QueryParams,
    opts?: ComAtprotoSyncGetRoot.CallOptions
  ): Promise<ComAtprotoSyncGetRoot.Response> {
    return this._service.xrpc
      .call('com.atproto.syncGetRoot', params, undefined, opts)
      .catch((e) => {
        throw ComAtprotoSyncGetRoot.toKnownErr(e)
      })
  }

  syncUpdateRepo(
    data?: ComAtprotoSyncUpdateRepo.InputSchema,
    opts?: ComAtprotoSyncUpdateRepo.CallOptions
  ): Promise<ComAtprotoSyncUpdateRepo.Response> {
    return this._service.xrpc
      .call('com.atproto.syncUpdateRepo', opts?.qp, data, opts)
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
  declaration: DeclarationRecord
  follow: FollowRecord
  invite: InviteRecord
  inviteAccept: InviteAcceptRecord
  like: LikeRecord
  mediaEmbed: MediaEmbedRecord
  post: PostRecord
  profile: ProfileRecord
  repost: RepostRecord

  constructor(service: ServiceClient) {
    this._service = service
    this.declaration = new DeclarationRecord(service)
    this.follow = new FollowRecord(service)
    this.invite = new InviteRecord(service)
    this.inviteAccept = new InviteAcceptRecord(service)
    this.like = new LikeRecord(service)
    this.mediaEmbed = new MediaEmbedRecord(service)
    this.post = new PostRecord(service)
    this.profile = new ProfileRecord(service)
    this.repost = new RepostRecord(service)
  }

  getAuthorFeed(
    params?: AppBskyGetAuthorFeed.QueryParams,
    opts?: AppBskyGetAuthorFeed.CallOptions
  ): Promise<AppBskyGetAuthorFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.getAuthorFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetAuthorFeed.toKnownErr(e)
      })
  }

  getHomeFeed(
    params?: AppBskyGetHomeFeed.QueryParams,
    opts?: AppBskyGetHomeFeed.CallOptions
  ): Promise<AppBskyGetHomeFeed.Response> {
    return this._service.xrpc
      .call('app.bsky.getHomeFeed', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetHomeFeed.toKnownErr(e)
      })
  }

  getLikedBy(
    params?: AppBskyGetLikedBy.QueryParams,
    opts?: AppBskyGetLikedBy.CallOptions
  ): Promise<AppBskyGetLikedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.getLikedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetLikedBy.toKnownErr(e)
      })
  }

  getNotificationCount(
    params?: AppBskyGetNotificationCount.QueryParams,
    opts?: AppBskyGetNotificationCount.CallOptions
  ): Promise<AppBskyGetNotificationCount.Response> {
    return this._service.xrpc
      .call('app.bsky.getNotificationCount', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetNotificationCount.toKnownErr(e)
      })
  }

  getNotifications(
    params?: AppBskyGetNotifications.QueryParams,
    opts?: AppBskyGetNotifications.CallOptions
  ): Promise<AppBskyGetNotifications.Response> {
    return this._service.xrpc
      .call('app.bsky.getNotifications', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetNotifications.toKnownErr(e)
      })
  }

  getPostThread(
    params?: AppBskyGetPostThread.QueryParams,
    opts?: AppBskyGetPostThread.CallOptions
  ): Promise<AppBskyGetPostThread.Response> {
    return this._service.xrpc
      .call('app.bsky.getPostThread', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetPostThread.toKnownErr(e)
      })
  }

  getProfile(
    params?: AppBskyGetProfile.QueryParams,
    opts?: AppBskyGetProfile.CallOptions
  ): Promise<AppBskyGetProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.getProfile', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetProfile.toKnownErr(e)
      })
  }

  getRepostedBy(
    params?: AppBskyGetRepostedBy.QueryParams,
    opts?: AppBskyGetRepostedBy.CallOptions
  ): Promise<AppBskyGetRepostedBy.Response> {
    return this._service.xrpc
      .call('app.bsky.getRepostedBy', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetRepostedBy.toKnownErr(e)
      })
  }

  getUserFollowers(
    params?: AppBskyGetUserFollowers.QueryParams,
    opts?: AppBskyGetUserFollowers.CallOptions
  ): Promise<AppBskyGetUserFollowers.Response> {
    return this._service.xrpc
      .call('app.bsky.getUserFollowers', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetUserFollowers.toKnownErr(e)
      })
  }

  getUserFollows(
    params?: AppBskyGetUserFollows.QueryParams,
    opts?: AppBskyGetUserFollows.CallOptions
  ): Promise<AppBskyGetUserFollows.Response> {
    return this._service.xrpc
      .call('app.bsky.getUserFollows', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetUserFollows.toKnownErr(e)
      })
  }

  getUsersSearch(
    params?: AppBskyGetUsersSearch.QueryParams,
    opts?: AppBskyGetUsersSearch.CallOptions
  ): Promise<AppBskyGetUsersSearch.Response> {
    return this._service.xrpc
      .call('app.bsky.getUsersSearch', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetUsersSearch.toKnownErr(e)
      })
  }

  getUsersTypeahead(
    params?: AppBskyGetUsersTypeahead.QueryParams,
    opts?: AppBskyGetUsersTypeahead.CallOptions
  ): Promise<AppBskyGetUsersTypeahead.Response> {
    return this._service.xrpc
      .call('app.bsky.getUsersTypeahead', params, undefined, opts)
      .catch((e) => {
        throw AppBskyGetUsersTypeahead.toKnownErr(e)
      })
  }

  postNotificationsSeen(
    data?: AppBskyPostNotificationsSeen.InputSchema,
    opts?: AppBskyPostNotificationsSeen.CallOptions
  ): Promise<AppBskyPostNotificationsSeen.Response> {
    return this._service.xrpc
      .call('app.bsky.postNotificationsSeen', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyPostNotificationsSeen.toKnownErr(e)
      })
  }

  updateProfile(
    data?: AppBskyUpdateProfile.InputSchema,
    opts?: AppBskyUpdateProfile.CallOptions
  ): Promise<AppBskyUpdateProfile.Response> {
    return this._service.xrpc
      .call('app.bsky.updateProfile', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyUpdateProfile.toKnownErr(e)
      })
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
    records: { uri: string, value: AppBskyDeclaration.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyDeclaration.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyDeclaration.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.declaration'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.declaration', ...params, record },
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
      undefined,
      { collection: 'app.bsky.declaration', ...params },
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
    records: { uri: string, value: AppBskyFollow.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyFollow.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.follow'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.follow', ...params, record },
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
      undefined,
      { collection: 'app.bsky.follow', ...params },
      { headers }
    )
  }
}

export class InviteRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyInvite.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.invite',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyInvite.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.invite',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyInvite.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.invite'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.invite', ...params, record },
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
      undefined,
      { collection: 'app.bsky.invite', ...params },
      { headers }
    )
  }
}

export class InviteAcceptRecord {
  _service: ServiceClient

  constructor(service: ServiceClient) {
    this._service = service
  }

  async list(
    params: Omit<ComAtprotoRepoListRecords.QueryParams, 'collection'>
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyInviteAccept.Record }[],
  }> {
    const res = await this._service.xrpc.call('com.atproto.repoListRecords', {
      collection: 'app.bsky.inviteAccept',
      ...params,
    })
    return res.data
  }

  async get(
    params: Omit<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string, cid: string, value: AppBskyInviteAccept.Record }> {
    const res = await this._service.xrpc.call('com.atproto.repoGetRecord', {
      collection: 'app.bsky.inviteAccept',
      ...params,
    })
    return res.data
  }

  async create(
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyInviteAccept.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.inviteAccept'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.inviteAccept', ...params, record },
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
      undefined,
      { collection: 'app.bsky.inviteAccept', ...params },
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
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyLike.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyLike.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.like'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.like', ...params, record },
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
      undefined,
      { collection: 'app.bsky.like', ...params },
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
    records: { uri: string, value: AppBskyMediaEmbed.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyMediaEmbed.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.mediaEmbed'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.mediaEmbed', ...params, record },
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
      undefined,
      { collection: 'app.bsky.mediaEmbed', ...params },
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
    records: { uri: string, value: AppBskyPost.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyPost.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.post'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.post', ...params, record },
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
      undefined,
      { collection: 'app.bsky.post', ...params },
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
  ): Promise<{
    cursor?: string,
    records: { uri: string, value: AppBskyProfile.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyProfile.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.profile'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.profile', ...params, record },
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
      undefined,
      { collection: 'app.bsky.profile', ...params },
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
    records: { uri: string, value: AppBskyRepost.Record }[],
  }> {
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
    params: Omit<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: AppBskyRepost.Record,
    headers?: Record<string, string>
  ): Promise<{ uri: string, cid: string }> {
    record.$type = 'app.bsky.repost'
    const res = await this._service.xrpc.call(
      'com.atproto.repoCreateRecord',
      undefined,
      { collection: 'app.bsky.repost', ...params, record },
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
      undefined,
      { collection: 'app.bsky.repost', ...params },
      { headers }
    )
  }
}
