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
import * as ChatBskyConvoAcceptConvo from '../../../../types/chat/bsky/convo/acceptConvo.js'
import * as ChatBskyConvoAddReaction from '../../../../types/chat/bsky/convo/addReaction.js'
import * as ChatBskyConvoDeleteMessageForSelf from '../../../../types/chat/bsky/convo/deleteMessageForSelf.js'
import * as ChatBskyConvoGetConvo from '../../../../types/chat/bsky/convo/getConvo.js'
import * as ChatBskyConvoGetConvoAvailability from '../../../../types/chat/bsky/convo/getConvoAvailability.js'
import * as ChatBskyConvoGetConvoForMembers from '../../../../types/chat/bsky/convo/getConvoForMembers.js'
import * as ChatBskyConvoGetLog from '../../../../types/chat/bsky/convo/getLog.js'
import * as ChatBskyConvoGetMessages from '../../../../types/chat/bsky/convo/getMessages.js'
import * as ChatBskyConvoLeaveConvo from '../../../../types/chat/bsky/convo/leaveConvo.js'
import * as ChatBskyConvoListConvos from '../../../../types/chat/bsky/convo/listConvos.js'
import * as ChatBskyConvoMuteConvo from '../../../../types/chat/bsky/convo/muteConvo.js'
import * as ChatBskyConvoRemoveReaction from '../../../../types/chat/bsky/convo/removeReaction.js'
import * as ChatBskyConvoSendMessage from '../../../../types/chat/bsky/convo/sendMessage.js'
import * as ChatBskyConvoSendMessageBatch from '../../../../types/chat/bsky/convo/sendMessageBatch.js'
import * as ChatBskyConvoUnmuteConvo from '../../../../types/chat/bsky/convo/unmuteConvo.js'
import * as ChatBskyConvoUpdateAllRead from '../../../../types/chat/bsky/convo/updateAllRead.js'
import * as ChatBskyConvoUpdateRead from '../../../../types/chat/bsky/convo/updateRead.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class ChatBskyConvoNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  acceptConvo(
    data?: ChatBskyConvoAcceptConvo.InputSchema,
    opts?: ChatBskyConvoAcceptConvo.CallOptions,
  ): Promise<ChatBskyConvoAcceptConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.acceptConvo',
      opts?.qp,
      data,
      opts,
    )
  }

  addReaction(
    data?: ChatBskyConvoAddReaction.InputSchema,
    opts?: ChatBskyConvoAddReaction.CallOptions,
  ): Promise<ChatBskyConvoAddReaction.Response> {
    return this._client
      .call('chat.bsky.convo.addReaction', opts?.qp, data, opts)
      .catch((e) => {
        throw ChatBskyConvoAddReaction.toKnownErr(e)
      })
  }

  deleteMessageForSelf(
    data?: ChatBskyConvoDeleteMessageForSelf.InputSchema,
    opts?: ChatBskyConvoDeleteMessageForSelf.CallOptions,
  ): Promise<ChatBskyConvoDeleteMessageForSelf.Response> {
    return this._client.call(
      'chat.bsky.convo.deleteMessageForSelf',
      opts?.qp,
      data,
      opts,
    )
  }

  getConvo(
    params?: ChatBskyConvoGetConvo.QueryParams,
    opts?: ChatBskyConvoGetConvo.CallOptions,
  ): Promise<ChatBskyConvoGetConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvo',
      params,
      undefined,
      opts,
    )
  }

  getConvoAvailability(
    params?: ChatBskyConvoGetConvoAvailability.QueryParams,
    opts?: ChatBskyConvoGetConvoAvailability.CallOptions,
  ): Promise<ChatBskyConvoGetConvoAvailability.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvoAvailability',
      params,
      undefined,
      opts,
    )
  }

  getConvoForMembers(
    params?: ChatBskyConvoGetConvoForMembers.QueryParams,
    opts?: ChatBskyConvoGetConvoForMembers.CallOptions,
  ): Promise<ChatBskyConvoGetConvoForMembers.Response> {
    return this._client.call(
      'chat.bsky.convo.getConvoForMembers',
      params,
      undefined,
      opts,
    )
  }

  getLog(
    params?: ChatBskyConvoGetLog.QueryParams,
    opts?: ChatBskyConvoGetLog.CallOptions,
  ): Promise<ChatBskyConvoGetLog.Response> {
    return this._client.call('chat.bsky.convo.getLog', params, undefined, opts)
  }

  getMessages(
    params?: ChatBskyConvoGetMessages.QueryParams,
    opts?: ChatBskyConvoGetMessages.CallOptions,
  ): Promise<ChatBskyConvoGetMessages.Response> {
    return this._client.call(
      'chat.bsky.convo.getMessages',
      params,
      undefined,
      opts,
    )
  }

  leaveConvo(
    data?: ChatBskyConvoLeaveConvo.InputSchema,
    opts?: ChatBskyConvoLeaveConvo.CallOptions,
  ): Promise<ChatBskyConvoLeaveConvo.Response> {
    return this._client.call('chat.bsky.convo.leaveConvo', opts?.qp, data, opts)
  }

  listConvos(
    params?: ChatBskyConvoListConvos.QueryParams,
    opts?: ChatBskyConvoListConvos.CallOptions,
  ): Promise<ChatBskyConvoListConvos.Response> {
    return this._client.call(
      'chat.bsky.convo.listConvos',
      params,
      undefined,
      opts,
    )
  }

  muteConvo(
    data?: ChatBskyConvoMuteConvo.InputSchema,
    opts?: ChatBskyConvoMuteConvo.CallOptions,
  ): Promise<ChatBskyConvoMuteConvo.Response> {
    return this._client.call('chat.bsky.convo.muteConvo', opts?.qp, data, opts)
  }

  removeReaction(
    data?: ChatBskyConvoRemoveReaction.InputSchema,
    opts?: ChatBskyConvoRemoveReaction.CallOptions,
  ): Promise<ChatBskyConvoRemoveReaction.Response> {
    return this._client
      .call('chat.bsky.convo.removeReaction', opts?.qp, data, opts)
      .catch((e) => {
        throw ChatBskyConvoRemoveReaction.toKnownErr(e)
      })
  }

  sendMessage(
    data?: ChatBskyConvoSendMessage.InputSchema,
    opts?: ChatBskyConvoSendMessage.CallOptions,
  ): Promise<ChatBskyConvoSendMessage.Response> {
    return this._client.call(
      'chat.bsky.convo.sendMessage',
      opts?.qp,
      data,
      opts,
    )
  }

  sendMessageBatch(
    data?: ChatBskyConvoSendMessageBatch.InputSchema,
    opts?: ChatBskyConvoSendMessageBatch.CallOptions,
  ): Promise<ChatBskyConvoSendMessageBatch.Response> {
    return this._client.call(
      'chat.bsky.convo.sendMessageBatch',
      opts?.qp,
      data,
      opts,
    )
  }

  unmuteConvo(
    data?: ChatBskyConvoUnmuteConvo.InputSchema,
    opts?: ChatBskyConvoUnmuteConvo.CallOptions,
  ): Promise<ChatBskyConvoUnmuteConvo.Response> {
    return this._client.call(
      'chat.bsky.convo.unmuteConvo',
      opts?.qp,
      data,
      opts,
    )
  }

  updateAllRead(
    data?: ChatBskyConvoUpdateAllRead.InputSchema,
    opts?: ChatBskyConvoUpdateAllRead.CallOptions,
  ): Promise<ChatBskyConvoUpdateAllRead.Response> {
    return this._client.call(
      'chat.bsky.convo.updateAllRead',
      opts?.qp,
      data,
      opts,
    )
  }

  updateRead(
    data?: ChatBskyConvoUpdateRead.InputSchema,
    opts?: ChatBskyConvoUpdateRead.CallOptions,
  ): Promise<ChatBskyConvoUpdateRead.Response> {
    return this._client.call('chat.bsky.convo.updateRead', opts?.qp, data, opts)
  }
}
