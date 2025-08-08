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
import { ChatBskyActorNS } from './actor/index.js'
import { ChatBskyConvoNS } from './convo/index.js'
import { ChatBskyModerationNS } from './moderation/index.js'

export class ChatBskyNS {
  _client: XrpcClient
  actor: ChatBskyActorNS
  convo: ChatBskyConvoNS
  moderation: ChatBskyModerationNS

  constructor(client: XrpcClient) {
    this._client = client
    this.actor = new ChatBskyActorNS(client)
    this.convo = new ChatBskyConvoNS(client)
    this.moderation = new ChatBskyModerationNS(client)
  }
}

export * from './actor/index.js'
export * from './convo/index.js'
export * from './moderation/index.js'
