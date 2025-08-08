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
import * as AppBskyEmbedExternal from '../../../../types/app/bsky/embed/external.js'
import * as AppBskyEmbedImages from '../../../../types/app/bsky/embed/images.js'
import * as AppBskyEmbedRecord from '../../../../types/app/bsky/embed/record.js'
import * as AppBskyEmbedRecordWithMedia from '../../../../types/app/bsky/embed/recordWithMedia.js'
import * as AppBskyEmbedVideo from '../../../../types/app/bsky/embed/video.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class AppBskyEmbedNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }
}
