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
import * as ChatBskyModerationGetActorMetadata from '../../../../types/chat/bsky/moderation/getActorMetadata.js'
import * as ChatBskyModerationGetMessageContext from '../../../../types/chat/bsky/moderation/getMessageContext.js'
import * as ChatBskyModerationUpdateActorAccess from '../../../../types/chat/bsky/moderation/updateActorAccess.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class ChatBskyModerationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getActorMetadata(
    params?: ChatBskyModerationGetActorMetadata.QueryParams,
    opts?: ChatBskyModerationGetActorMetadata.CallOptions,
  ): Promise<ChatBskyModerationGetActorMetadata.Response> {
    return this._client.call(
      'chat.bsky.moderation.getActorMetadata',
      params,
      undefined,
      opts,
    )
  }

  getMessageContext(
    params?: ChatBskyModerationGetMessageContext.QueryParams,
    opts?: ChatBskyModerationGetMessageContext.CallOptions,
  ): Promise<ChatBskyModerationGetMessageContext.Response> {
    return this._client.call(
      'chat.bsky.moderation.getMessageContext',
      params,
      undefined,
      opts,
    )
  }

  updateActorAccess(
    data?: ChatBskyModerationUpdateActorAccess.InputSchema,
    opts?: ChatBskyModerationUpdateActorAccess.CallOptions,
  ): Promise<ChatBskyModerationUpdateActorAccess.Response> {
    return this._client.call(
      'chat.bsky.moderation.updateActorAccess',
      opts?.qp,
      data,
      opts,
    )
  }
}
