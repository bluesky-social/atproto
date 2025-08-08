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
import { Server } from '../../index.js'
import { ChatBskyNS } from './bsky/index.js'

export class ChatNS {
  _server: Server
  bsky: ChatBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new ChatBskyNS(server)
  }
}

export * from './bsky/index.js'
