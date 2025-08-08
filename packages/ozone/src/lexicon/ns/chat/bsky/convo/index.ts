/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
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
import { Server } from '../../../../index.js'

export class ChatBskyConvoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  acceptConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoAcceptConvo.QueryParams,
      ChatBskyConvoAcceptConvo.HandlerInput,
      ChatBskyConvoAcceptConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.acceptConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  addReaction<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoAddReaction.QueryParams,
      ChatBskyConvoAddReaction.HandlerInput,
      ChatBskyConvoAddReaction.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.addReaction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteMessageForSelf<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoDeleteMessageForSelf.QueryParams,
      ChatBskyConvoDeleteMessageForSelf.HandlerInput,
      ChatBskyConvoDeleteMessageForSelf.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.deleteMessageForSelf' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvo.QueryParams,
      ChatBskyConvoGetConvo.HandlerInput,
      ChatBskyConvoGetConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvoAvailability<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvoAvailability.QueryParams,
      ChatBskyConvoGetConvoAvailability.HandlerInput,
      ChatBskyConvoGetConvoAvailability.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvoAvailability' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConvoForMembers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetConvoForMembers.QueryParams,
      ChatBskyConvoGetConvoForMembers.HandlerInput,
      ChatBskyConvoGetConvoForMembers.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getConvoForMembers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLog<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetLog.QueryParams,
      ChatBskyConvoGetLog.HandlerInput,
      ChatBskyConvoGetLog.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getLog' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMessages<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoGetMessages.QueryParams,
      ChatBskyConvoGetMessages.HandlerInput,
      ChatBskyConvoGetMessages.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.getMessages' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  leaveConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoLeaveConvo.QueryParams,
      ChatBskyConvoLeaveConvo.HandlerInput,
      ChatBskyConvoLeaveConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.leaveConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listConvos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoListConvos.QueryParams,
      ChatBskyConvoListConvos.HandlerInput,
      ChatBskyConvoListConvos.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.listConvos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoMuteConvo.QueryParams,
      ChatBskyConvoMuteConvo.HandlerInput,
      ChatBskyConvoMuteConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.muteConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  removeReaction<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoRemoveReaction.QueryParams,
      ChatBskyConvoRemoveReaction.HandlerInput,
      ChatBskyConvoRemoveReaction.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.removeReaction' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendMessage<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoSendMessage.QueryParams,
      ChatBskyConvoSendMessage.HandlerInput,
      ChatBskyConvoSendMessage.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.sendMessage' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendMessageBatch<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoSendMessageBatch.QueryParams,
      ChatBskyConvoSendMessageBatch.HandlerInput,
      ChatBskyConvoSendMessageBatch.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.sendMessageBatch' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteConvo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUnmuteConvo.QueryParams,
      ChatBskyConvoUnmuteConvo.HandlerInput,
      ChatBskyConvoUnmuteConvo.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.unmuteConvo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAllRead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUpdateAllRead.QueryParams,
      ChatBskyConvoUpdateAllRead.HandlerInput,
      ChatBskyConvoUpdateAllRead.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.updateAllRead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateRead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyConvoUpdateRead.QueryParams,
      ChatBskyConvoUpdateRead.HandlerInput,
      ChatBskyConvoUpdateRead.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.convo.updateRead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
