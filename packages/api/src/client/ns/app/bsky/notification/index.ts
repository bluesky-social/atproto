/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from '../../../../lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from '../../../../util.js'
import * as AppBskyNotificationDeclaration from '../../../../types/app/bsky/notification/declaration.js'
import * as AppBskyNotificationGetPreferences from '../../../../types/app/bsky/notification/getPreferences.js'
import * as AppBskyNotificationGetUnreadCount from '../../../../types/app/bsky/notification/getUnreadCount.js'
import * as AppBskyNotificationListActivitySubscriptions from '../../../../types/app/bsky/notification/listActivitySubscriptions.js'
import * as AppBskyNotificationListNotifications from '../../../../types/app/bsky/notification/listNotifications.js'
import * as AppBskyNotificationPutActivitySubscription from '../../../../types/app/bsky/notification/putActivitySubscription.js'
import * as AppBskyNotificationPutPreferences from '../../../../types/app/bsky/notification/putPreferences.js'
import * as AppBskyNotificationPutPreferencesV2 from '../../../../types/app/bsky/notification/putPreferencesV2.js'
import * as AppBskyNotificationRegisterPush from '../../../../types/app/bsky/notification/registerPush.js'
import * as AppBskyNotificationUnregisterPush from '../../../../types/app/bsky/notification/unregisterPush.js'
import * as AppBskyNotificationUpdateSeen from '../../../../types/app/bsky/notification/updateSeen.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class AppBskyNotificationNS {
  _client: XrpcClient
  declaration: AppBskyNotificationDeclarationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.declaration = new AppBskyNotificationDeclarationRecord(client)
  }

  getPreferences(
    params?: AppBskyNotificationGetPreferences.QueryParams,
    opts?: AppBskyNotificationGetPreferences.CallOptions,
  ): Promise<AppBskyNotificationGetPreferences.Response> {
    return this._client.call(
      'app.bsky.notification.getPreferences',
      params,
      undefined,
      opts,
    )
  }

  getUnreadCount(
    params?: AppBskyNotificationGetUnreadCount.QueryParams,
    opts?: AppBskyNotificationGetUnreadCount.CallOptions,
  ): Promise<AppBskyNotificationGetUnreadCount.Response> {
    return this._client.call(
      'app.bsky.notification.getUnreadCount',
      params,
      undefined,
      opts,
    )
  }

  listActivitySubscriptions(
    params?: AppBskyNotificationListActivitySubscriptions.QueryParams,
    opts?: AppBskyNotificationListActivitySubscriptions.CallOptions,
  ): Promise<AppBskyNotificationListActivitySubscriptions.Response> {
    return this._client.call(
      'app.bsky.notification.listActivitySubscriptions',
      params,
      undefined,
      opts,
    )
  }

  listNotifications(
    params?: AppBskyNotificationListNotifications.QueryParams,
    opts?: AppBskyNotificationListNotifications.CallOptions,
  ): Promise<AppBskyNotificationListNotifications.Response> {
    return this._client.call(
      'app.bsky.notification.listNotifications',
      params,
      undefined,
      opts,
    )
  }

  putActivitySubscription(
    data?: AppBskyNotificationPutActivitySubscription.InputSchema,
    opts?: AppBskyNotificationPutActivitySubscription.CallOptions,
  ): Promise<AppBskyNotificationPutActivitySubscription.Response> {
    return this._client.call(
      'app.bsky.notification.putActivitySubscription',
      opts?.qp,
      data,
      opts,
    )
  }

  putPreferences(
    data?: AppBskyNotificationPutPreferences.InputSchema,
    opts?: AppBskyNotificationPutPreferences.CallOptions,
  ): Promise<AppBskyNotificationPutPreferences.Response> {
    return this._client.call(
      'app.bsky.notification.putPreferences',
      opts?.qp,
      data,
      opts,
    )
  }

  putPreferencesV2(
    data?: AppBskyNotificationPutPreferencesV2.InputSchema,
    opts?: AppBskyNotificationPutPreferencesV2.CallOptions,
  ): Promise<AppBskyNotificationPutPreferencesV2.Response> {
    return this._client.call(
      'app.bsky.notification.putPreferencesV2',
      opts?.qp,
      data,
      opts,
    )
  }

  registerPush(
    data?: AppBskyNotificationRegisterPush.InputSchema,
    opts?: AppBskyNotificationRegisterPush.CallOptions,
  ): Promise<AppBskyNotificationRegisterPush.Response> {
    return this._client.call(
      'app.bsky.notification.registerPush',
      opts?.qp,
      data,
      opts,
    )
  }

  unregisterPush(
    data?: AppBskyNotificationUnregisterPush.InputSchema,
    opts?: AppBskyNotificationUnregisterPush.CallOptions,
  ): Promise<AppBskyNotificationUnregisterPush.Response> {
    return this._client.call(
      'app.bsky.notification.unregisterPush',
      opts?.qp,
      data,
      opts,
    )
  }

  updateSeen(
    data?: AppBskyNotificationUpdateSeen.InputSchema,
    opts?: AppBskyNotificationUpdateSeen.CallOptions,
  ): Promise<AppBskyNotificationUpdateSeen.Response> {
    return this._client.call(
      'app.bsky.notification.updateSeen',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AppBskyNotificationDeclarationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyNotificationDeclaration.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.notification.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyNotificationDeclaration.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.notification.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyNotificationDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.notification.declaration'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyNotificationDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.notification.declaration'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'app.bsky.notification.declaration', ...params },
      { headers },
    )
  }
}
