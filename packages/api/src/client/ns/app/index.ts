/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from '../../lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from '../../util.js'
import * as ComAtprotoRepoCreateRecord from '../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../types/com/atproto/repo/putRecord.js'
import { AppBskyNS } from './bsky/index.js'

export class AppNS {
  _client: XrpcClient
  bsky: AppBskyNS

  constructor(client: XrpcClient) {
    this._client = client
    this.bsky = new AppBskyNS(client)
  }
}

export * from './bsky/index.js'
