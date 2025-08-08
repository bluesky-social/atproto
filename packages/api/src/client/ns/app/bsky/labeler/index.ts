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
import * as AppBskyLabelerGetServices from '../../../../types/app/bsky/labeler/getServices.js'
import * as AppBskyLabelerService from '../../../../types/app/bsky/labeler/service.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class AppBskyLabelerNS {
  _client: XrpcClient
  service: AppBskyLabelerServiceRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.service = new AppBskyLabelerServiceRecord(client)
  }

  getServices(
    params?: AppBskyLabelerGetServices.QueryParams,
    opts?: AppBskyLabelerGetServices.CallOptions,
  ): Promise<AppBskyLabelerGetServices.Response> {
    return this._client.call(
      'app.bsky.labeler.getServices',
      params,
      undefined,
      opts,
    )
  }
}

export class AppBskyLabelerServiceRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AppBskyLabelerService.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'app.bsky.labeler.service',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AppBskyLabelerService.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'app.bsky.labeler.service',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AppBskyLabelerService.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.labeler.service'
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
    record: Un$Typed<AppBskyLabelerService.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'app.bsky.labeler.service'
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
      { collection: 'app.bsky.labeler.service', ...params },
      { headers },
    )
  }
}
