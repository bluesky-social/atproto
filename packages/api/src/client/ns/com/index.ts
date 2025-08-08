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
import { ComAtprotoNS } from './atproto/index.js'

export class ComNS {
  _client: XrpcClient
  atproto: ComAtprotoNS

  constructor(client: XrpcClient) {
    this._client = client
    this.atproto = new ComAtprotoNS(client)
  }
}

export * from './atproto/index.js'
