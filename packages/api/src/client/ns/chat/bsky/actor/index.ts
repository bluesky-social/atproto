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
import * as ChatBskyActorDeclaration from '../../../../types/chat/bsky/actor/declaration.js'
import * as ChatBskyActorDeleteAccount from '../../../../types/chat/bsky/actor/deleteAccount.js'
import * as ChatBskyActorExportAccountData from '../../../../types/chat/bsky/actor/exportAccountData.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class ChatBskyActorNS {
  _client: XrpcClient
  declaration: ChatBskyActorDeclarationRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.declaration = new ChatBskyActorDeclarationRecord(client)
  }

  deleteAccount(
    data?: ChatBskyActorDeleteAccount.InputSchema,
    opts?: ChatBskyActorDeleteAccount.CallOptions,
  ): Promise<ChatBskyActorDeleteAccount.Response> {
    return this._client.call(
      'chat.bsky.actor.deleteAccount',
      opts?.qp,
      data,
      opts,
    )
  }

  exportAccountData(
    params?: ChatBskyActorExportAccountData.QueryParams,
    opts?: ChatBskyActorExportAccountData.CallOptions,
  ): Promise<ChatBskyActorExportAccountData.Response> {
    return this._client.call(
      'chat.bsky.actor.exportAccountData',
      params,
      undefined,
      opts,
    )
  }
}

export class ChatBskyActorDeclarationRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: ChatBskyActorDeclaration.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'chat.bsky.actor.declaration',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: ChatBskyActorDeclaration.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'chat.bsky.actor.declaration',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<ChatBskyActorDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'chat.bsky.actor.declaration'
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
    record: Un$Typed<ChatBskyActorDeclaration.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'chat.bsky.actor.declaration'
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
      { collection: 'chat.bsky.actor.declaration', ...params },
      { headers },
    )
  }
}
