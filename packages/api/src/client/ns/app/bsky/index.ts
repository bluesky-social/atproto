/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from '../../../lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from '../../../util.js'
import * as ComAtprotoRepoCreateRecord from '../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../types/com/atproto/repo/putRecord.js'
import { AppBskyActorNS } from './actor/index.js'
import { AppBskyEmbedNS } from './embed/index.js'
import { AppBskyFeedNS } from './feed/index.js'
import { AppBskyGraphNS } from './graph/index.js'
import { AppBskyLabelerNS } from './labeler/index.js'
import { AppBskyNotificationNS } from './notification/index.js'
import { AppBskyRichtextNS } from './richtext/index.js'
import { AppBskyUnspeccedNS } from './unspecced/index.js'
import { AppBskyVideoNS } from './video/index.js'

export class AppBskyNS {
  _client: XrpcClient
  actor: AppBskyActorNS
  embed: AppBskyEmbedNS
  feed: AppBskyFeedNS
  graph: AppBskyGraphNS
  labeler: AppBskyLabelerNS
  notification: AppBskyNotificationNS
  richtext: AppBskyRichtextNS
  unspecced: AppBskyUnspeccedNS
  video: AppBskyVideoNS

  constructor(client: XrpcClient) {
    this._client = client
    this.actor = new AppBskyActorNS(client)
    this.embed = new AppBskyEmbedNS(client)
    this.feed = new AppBskyFeedNS(client)
    this.graph = new AppBskyGraphNS(client)
    this.labeler = new AppBskyLabelerNS(client)
    this.notification = new AppBskyNotificationNS(client)
    this.richtext = new AppBskyRichtextNS(client)
    this.unspecced = new AppBskyUnspeccedNS(client)
    this.video = new AppBskyVideoNS(client)
  }
}

export * from './actor/index.js'
export * from './embed/index.js'
export * from './feed/index.js'
export * from './graph/index.js'
export * from './labeler/index.js'
export * from './notification/index.js'
export * from './richtext/index.js'
export * from './unspecced/index.js'
export * from './video/index.js'
