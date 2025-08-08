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
import { ToolsOzoneNS } from './ozone/index.js'

export class ToolsNS {
  _client: XrpcClient
  ozone: ToolsOzoneNS

  constructor(client: XrpcClient) {
    this._client = client
    this.ozone = new ToolsOzoneNS(client)
  }
}

export * from './ozone/index.js'
