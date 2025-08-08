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
import { Server } from '../../../index.js'
import { ChatBskyActorNS } from './actor/index.js'
import { ChatBskyConvoNS } from './convo/index.js'
import { ChatBskyModerationNS } from './moderation/index.js'

export class ChatBskyNS {
  _server: Server
  actor: ChatBskyActorNS
  convo: ChatBskyConvoNS
  moderation: ChatBskyModerationNS

  constructor(server: Server) {
    this._server = server
    this.actor = new ChatBskyActorNS(server)
    this.convo = new ChatBskyConvoNS(server)
    this.moderation = new ChatBskyModerationNS(server)
  }
}

export * from './actor/index.js'
export * from './convo/index.js'
export * from './moderation/index.js'
