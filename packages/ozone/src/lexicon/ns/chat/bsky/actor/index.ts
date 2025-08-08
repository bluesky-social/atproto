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
import * as ChatBskyActorDeclaration from '../../../../types/chat/bsky/actor/declaration.js'
import * as ChatBskyActorDeleteAccount from '../../../../types/chat/bsky/actor/deleteAccount.js'
import * as ChatBskyActorExportAccountData from '../../../../types/chat/bsky/actor/exportAccountData.js'
import { Server } from '../../../../index.js'

export class ChatBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteAccount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyActorDeleteAccount.QueryParams,
      ChatBskyActorDeleteAccount.HandlerInput,
      ChatBskyActorDeleteAccount.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.actor.deleteAccount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  exportAccountData<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ChatBskyActorExportAccountData.QueryParams,
      ChatBskyActorExportAccountData.HandlerInput,
      ChatBskyActorExportAccountData.HandlerOutput
    >,
  ) {
    const nsid = 'chat.bsky.actor.exportAccountData' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
