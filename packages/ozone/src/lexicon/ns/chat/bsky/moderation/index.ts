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
import * as ChatBskyModerationGetActorMetadata from '../../../../types/chat/bsky/moderation/getActorMetadata.js'
import * as ChatBskyModerationGetMessageContext from '../../../../types/chat/bsky/moderation/getMessageContext.js'
import * as ChatBskyModerationUpdateActorAccess from '../../../../types/chat/bsky/moderation/updateActorAccess.js'
import { Server } from '../../../../index.js'

export class ChatBskyModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getActorMetadata<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationGetActorMetadata.QueryParams,
      ChatBskyModerationGetActorMetadata.HandlerInput,
      ChatBskyModerationGetActorMetadata.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.getActorMetadata' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMessageContext<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationGetMessageContext.QueryParams,
      ChatBskyModerationGetMessageContext.HandlerInput,
      ChatBskyModerationGetMessageContext.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.getMessageContext' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateActorAccess<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyModerationUpdateActorAccess.QueryParams,
      ChatBskyModerationUpdateActorAccess.HandlerInput,
      ChatBskyModerationUpdateActorAccess.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.moderation.updateActorAccess' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
