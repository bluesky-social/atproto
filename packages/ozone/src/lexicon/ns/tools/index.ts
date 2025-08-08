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
import { ToolsOzoneNS } from './ozone/index.js'

export class ToolsNS {
  _server: Server
  ozone: ToolsOzoneNS

  constructor(server: Server) {
    this._server = server
    this.ozone = new ToolsOzoneNS(server)
  }
}

export * from './ozone/index.js'
