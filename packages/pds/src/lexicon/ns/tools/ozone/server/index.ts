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
import * as ToolsOzoneServerGetConfig from '../../../../types/tools/ozone/server/getConfig.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneServerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getConfig<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneServerGetConfig.QueryParams,
      ToolsOzoneServerGetConfig.HandlerInput,
      ToolsOzoneServerGetConfig.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.server.getConfig' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
