/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import { Client as XrpcClient } from '@adxp/xrpc'
import { methodSchemas, recordSchemas } from './schemas'
import * as TodoAdxCreateAccount from './types/todo/adx/createAccount'
import * as TodoAdxCreateSession from './types/todo/adx/createSession'
import * as TodoAdxDeleteAccount from './types/todo/adx/deleteAccount'
import * as TodoAdxDeleteSession from './types/todo/adx/deleteSession'
import * as TodoAdxGetAccount from './types/todo/adx/getAccount'
import * as TodoAdxGetSession from './types/todo/adx/getSession'
import * as TodoAdxRepoBatchWrite from './types/todo/adx/repoBatchWrite'
import * as TodoAdxRepoCreateRecord from './types/todo/adx/repoCreateRecord'
import * as TodoAdxRepoDeleteRecord from './types/todo/adx/repoDeleteRecord'
import * as TodoAdxRepoDescribe from './types/todo/adx/repoDescribe'
import * as TodoAdxRepoGetRecord from './types/todo/adx/repoGetRecord'
import * as TodoAdxRepoListRecords from './types/todo/adx/repoListRecords'
import * as TodoAdxRepoPutRecord from './types/todo/adx/repoPutRecord'
import * as TodoAdxResolveName from './types/todo/adx/resolveName'
import * as TodoAdxSyncGetRepo from './types/todo/adx/syncGetRepo'
import * as TodoAdxSyncGetRoot from './types/todo/adx/syncGetRoot'
import * as TodoAdxSyncUpdateRepo from './types/todo/adx/syncUpdateRepo'
import * as TodoSocialBadge from './types/todo/social/badge'
import * as TodoSocialFollow from './types/todo/social/follow'
import * as TodoSocialGetFeedView from './types/todo/social/getFeedView'
import * as TodoSocialGetLikedByView from './types/todo/social/getLikedByView'
import * as TodoSocialGetNotificationsView from './types/todo/social/getNotificationsView'
import * as TodoSocialGetPostThreadView from './types/todo/social/getPostThreadView'
import * as TodoSocialGetProfileView from './types/todo/social/getProfileView'
import * as TodoSocialGetRepostedByView from './types/todo/social/getRepostedByView'
import * as TodoSocialGetUserFollowersView from './types/todo/social/getUserFollowersView'
import * as TodoSocialGetUserFollowsView from './types/todo/social/getUserFollowsView'
import * as TodoSocialLike from './types/todo/social/like'
import * as TodoSocialMediaEmbed from './types/todo/social/mediaEmbed'
import * as TodoSocialPost from './types/todo/social/post'
import * as TodoSocialProfile from './types/todo/social/profile'
import * as TodoSocialRepost from './types/todo/social/repost'

export class API {
  xrpc: XrpcClient = new XrpcClient()
  todo: TodoNS

  constructor() {
    this.xrpc.addSchemas(methodSchemas)
    this.todo = new TodoNS(this)
  }
}

export class TodoNS {
  api: API
  adx: AdxNS
  social: SocialNS

  constructor(api: API) {
    this.api = api
    this.adx = new AdxNS(api)
    this.social = new SocialNS(api)
  }
}

export class AdxNS {
  api: API

  constructor(api: API) {
    this.api = api
  }

  createAccount(
    serviceUri: string,
    params: TodoAdxCreateAccount.QueryParams,
    data?: TodoAdxCreateAccount.InputSchema,
    opts?: TodoAdxCreateAccount.CallOptions
  ): Promise<TodoAdxCreateAccount.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.createAccount',
      params,
      data,
      opts
    )
  }

  createSession(
    serviceUri: string,
    params: TodoAdxCreateSession.QueryParams,
    data?: TodoAdxCreateSession.InputSchema,
    opts?: TodoAdxCreateSession.CallOptions
  ): Promise<TodoAdxCreateSession.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.createSession',
      params,
      data,
      opts
    )
  }

  deleteAccount(
    serviceUri: string,
    params: TodoAdxDeleteAccount.QueryParams,
    data?: TodoAdxDeleteAccount.InputSchema,
    opts?: TodoAdxDeleteAccount.CallOptions
  ): Promise<TodoAdxDeleteAccount.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.deleteAccount',
      params,
      data,
      opts
    )
  }

  deleteSession(
    serviceUri: string,
    params: TodoAdxDeleteSession.QueryParams,
    data?: TodoAdxDeleteSession.InputSchema,
    opts?: TodoAdxDeleteSession.CallOptions
  ): Promise<TodoAdxDeleteSession.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.deleteSession',
      params,
      data,
      opts
    )
  }

  getAccount(
    serviceUri: string,
    params: TodoAdxGetAccount.QueryParams,
    data?: TodoAdxGetAccount.InputSchema,
    opts?: TodoAdxGetAccount.CallOptions
  ): Promise<TodoAdxGetAccount.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.getAccount',
      params,
      data,
      opts
    )
  }

  getSession(
    serviceUri: string,
    params: TodoAdxGetSession.QueryParams,
    data?: TodoAdxGetSession.InputSchema,
    opts?: TodoAdxGetSession.CallOptions
  ): Promise<TodoAdxGetSession.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.getSession',
      params,
      data,
      opts
    )
  }

  repoBatchWrite(
    serviceUri: string,
    params: TodoAdxRepoBatchWrite.QueryParams,
    data?: TodoAdxRepoBatchWrite.InputSchema,
    opts?: TodoAdxRepoBatchWrite.CallOptions
  ): Promise<TodoAdxRepoBatchWrite.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoBatchWrite',
      params,
      data,
      opts
    )
  }

  repoCreateRecord(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    data?: TodoAdxRepoCreateRecord.InputSchema,
    opts?: TodoAdxRepoCreateRecord.CallOptions
  ): Promise<TodoAdxRepoCreateRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      data,
      opts
    )
  }

  repoDeleteRecord(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams,
    data?: TodoAdxRepoDeleteRecord.InputSchema,
    opts?: TodoAdxRepoDeleteRecord.CallOptions
  ): Promise<TodoAdxRepoDeleteRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoDeleteRecord',
      params,
      data,
      opts
    )
  }

  repoDescribe(
    serviceUri: string,
    params: TodoAdxRepoDescribe.QueryParams,
    data?: TodoAdxRepoDescribe.InputSchema,
    opts?: TodoAdxRepoDescribe.CallOptions
  ): Promise<TodoAdxRepoDescribe.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoDescribe',
      params,
      data,
      opts
    )
  }

  repoGetRecord(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams,
    data?: TodoAdxRepoGetRecord.InputSchema,
    opts?: TodoAdxRepoGetRecord.CallOptions
  ): Promise<TodoAdxRepoGetRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoGetRecord',
      params,
      data,
      opts
    )
  }

  repoListRecords(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams,
    data?: TodoAdxRepoListRecords.InputSchema,
    opts?: TodoAdxRepoListRecords.CallOptions
  ): Promise<TodoAdxRepoListRecords.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params,
      data,
      opts
    )
  }

  repoPutRecord(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    data?: TodoAdxRepoPutRecord.InputSchema,
    opts?: TodoAdxRepoPutRecord.CallOptions
  ): Promise<TodoAdxRepoPutRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      data,
      opts
    )
  }

  resolveName(
    serviceUri: string,
    params: TodoAdxResolveName.QueryParams,
    data?: TodoAdxResolveName.InputSchema,
    opts?: TodoAdxResolveName.CallOptions
  ): Promise<TodoAdxResolveName.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.resolveName',
      params,
      data,
      opts
    )
  }

  syncGetRepo(
    serviceUri: string,
    params: TodoAdxSyncGetRepo.QueryParams,
    data?: TodoAdxSyncGetRepo.InputSchema,
    opts?: TodoAdxSyncGetRepo.CallOptions
  ): Promise<TodoAdxSyncGetRepo.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.syncGetRepo',
      params,
      data,
      opts
    )
  }

  syncGetRoot(
    serviceUri: string,
    params: TodoAdxSyncGetRoot.QueryParams,
    data?: TodoAdxSyncGetRoot.InputSchema,
    opts?: TodoAdxSyncGetRoot.CallOptions
  ): Promise<TodoAdxSyncGetRoot.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.syncGetRoot',
      params,
      data,
      opts
    )
  }

  syncUpdateRepo(
    serviceUri: string,
    params: TodoAdxSyncUpdateRepo.QueryParams,
    data?: TodoAdxSyncUpdateRepo.InputSchema,
    opts?: TodoAdxSyncUpdateRepo.CallOptions
  ): Promise<TodoAdxSyncUpdateRepo.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.syncUpdateRepo',
      params,
      data,
      opts
    )
  }
}

export class SocialNS {
  api: API
  badge: BadgeRecord
  follow: FollowRecord
  like: LikeRecord
  mediaEmbed: MediaEmbedRecord
  post: PostRecord
  profile: ProfileRecord
  repost: RepostRecord

  constructor(api: API) {
    this.api = api
    this.badge = new BadgeRecord(api)
    this.follow = new FollowRecord(api)
    this.like = new LikeRecord(api)
    this.mediaEmbed = new MediaEmbedRecord(api)
    this.post = new PostRecord(api)
    this.profile = new ProfileRecord(api)
    this.repost = new RepostRecord(api)
  }

  getFeedView(
    serviceUri: string,
    params: TodoSocialGetFeedView.QueryParams,
    data?: TodoSocialGetFeedView.InputSchema,
    opts?: TodoSocialGetFeedView.CallOptions
  ): Promise<TodoSocialGetFeedView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getFeedView',
      params,
      data,
      opts
    )
  }

  getLikedByView(
    serviceUri: string,
    params: TodoSocialGetLikedByView.QueryParams,
    data?: TodoSocialGetLikedByView.InputSchema,
    opts?: TodoSocialGetLikedByView.CallOptions
  ): Promise<TodoSocialGetLikedByView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getLikedByView',
      params,
      data,
      opts
    )
  }

  getNotificationsView(
    serviceUri: string,
    params: TodoSocialGetNotificationsView.QueryParams,
    data?: TodoSocialGetNotificationsView.InputSchema,
    opts?: TodoSocialGetNotificationsView.CallOptions
  ): Promise<TodoSocialGetNotificationsView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getNotificationsView',
      params,
      data,
      opts
    )
  }

  getPostThreadView(
    serviceUri: string,
    params: TodoSocialGetPostThreadView.QueryParams,
    data?: TodoSocialGetPostThreadView.InputSchema,
    opts?: TodoSocialGetPostThreadView.CallOptions
  ): Promise<TodoSocialGetPostThreadView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getPostThreadView',
      params,
      data,
      opts
    )
  }

  getProfileView(
    serviceUri: string,
    params: TodoSocialGetProfileView.QueryParams,
    data?: TodoSocialGetProfileView.InputSchema,
    opts?: TodoSocialGetProfileView.CallOptions
  ): Promise<TodoSocialGetProfileView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getProfileView',
      params,
      data,
      opts
    )
  }

  getRepostedByView(
    serviceUri: string,
    params: TodoSocialGetRepostedByView.QueryParams,
    data?: TodoSocialGetRepostedByView.InputSchema,
    opts?: TodoSocialGetRepostedByView.CallOptions
  ): Promise<TodoSocialGetRepostedByView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getRepostedByView',
      params,
      data,
      opts
    )
  }

  getUserFollowersView(
    serviceUri: string,
    params: TodoSocialGetUserFollowersView.QueryParams,
    data?: TodoSocialGetUserFollowersView.InputSchema,
    opts?: TodoSocialGetUserFollowersView.CallOptions
  ): Promise<TodoSocialGetUserFollowersView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getUserFollowersView',
      params,
      data,
      opts
    )
  }

  getUserFollowsView(
    serviceUri: string,
    params: TodoSocialGetUserFollowsView.QueryParams,
    data?: TodoSocialGetUserFollowsView.InputSchema,
    opts?: TodoSocialGetUserFollowsView.CallOptions
  ): Promise<TodoSocialGetUserFollowsView.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.social.getUserFollowsView',
      params,
      data,
      opts
    )
  }
}

export class BadgeRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialBadge.Record }[] }> {
    params.type = 'todo.social.badge'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialBadge.Record> {
    params.type = 'todo.social.badge'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialBadge.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.badge'
    record.$type = 'todo.social.badge'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialBadge.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.badge'
    record.$type = 'todo.social.badge'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.badge'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class FollowRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialFollow.Record }[] }> {
    params.type = 'todo.social.follow'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialFollow.Record> {
    params.type = 'todo.social.follow'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialFollow.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.follow'
    record.$type = 'todo.social.follow'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialFollow.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.follow'
    record.$type = 'todo.social.follow'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.follow'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class LikeRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialLike.Record }[] }> {
    params.type = 'todo.social.like'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialLike.Record> {
    params.type = 'todo.social.like'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialLike.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.like'
    record.$type = 'todo.social.like'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialLike.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.like'
    record.$type = 'todo.social.like'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.like'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class MediaEmbedRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{
    records: { uri: string, value: TodoSocialMediaEmbed.Record }[],
  }> {
    params.type = 'todo.social.mediaEmbed'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialMediaEmbed.Record> {
    params.type = 'todo.social.mediaEmbed'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialMediaEmbed.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.mediaEmbed'
    record.$type = 'todo.social.mediaEmbed'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialMediaEmbed.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.mediaEmbed'
    record.$type = 'todo.social.mediaEmbed'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.mediaEmbed'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class PostRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialPost.Record }[] }> {
    params.type = 'todo.social.post'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialPost.Record> {
    params.type = 'todo.social.post'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialPost.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.post'
    record.$type = 'todo.social.post'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialPost.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.post'
    record.$type = 'todo.social.post'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.post'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class ProfileRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialProfile.Record }[] }> {
    params.type = 'todo.social.profile'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialProfile.Record> {
    params.type = 'todo.social.profile'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialProfile.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.profile'
    record.$type = 'todo.social.profile'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialProfile.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.profile'
    record.$type = 'todo.social.profile'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.profile'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}

export class RepostRecord {
  api: API

  constructor(api: API) {
    this.api = api
  }

  async list(
    serviceUri: string,
    params: TodoAdxRepoListRecords.QueryParams
  ): Promise<{ records: { uri: string, value: TodoSocialRepost.Record }[] }> {
    params.type = 'todo.social.repost'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async get(
    serviceUri: string,
    params: TodoAdxRepoGetRecord.QueryParams
  ): Promise<TodoSocialRepost.Record> {
    params.type = 'todo.social.repost'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params
    )
    return res.data
  }

  async create(
    serviceUri: string,
    params: TodoAdxRepoCreateRecord.QueryParams,
    record: TodoSocialRepost.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.repost'
    record.$type = 'todo.social.repost'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async put(
    serviceUri: string,
    params: TodoAdxRepoPutRecord.QueryParams,
    record: TodoSocialRepost.Record
  ): Promise<{ uri: string }> {
    params.type = 'todo.social.repost'
    record.$type = 'todo.social.repost'
    const res = await this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      record,
      { encoding: 'application/json' }
    )
    return res.data
  }

  async delete(
    serviceUri: string,
    params: TodoAdxRepoDeleteRecord.QueryParams
  ): Promise<void> {
    params.type = 'todo.social.repost'
    await this.api.xrpc.call(serviceUri, 'todo.adx.repoDeleteRecord', params)
  }
}
