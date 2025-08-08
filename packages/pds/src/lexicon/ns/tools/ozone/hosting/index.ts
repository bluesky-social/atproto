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
import * as ToolsOzoneHostingGetAccountHistory from '../../../../types/tools/ozone/hosting/getAccountHistory.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneHostingNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAccountHistory<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneHostingGetAccountHistory.QueryParams,
      ToolsOzoneHostingGetAccountHistory.HandlerInput,
      ToolsOzoneHostingGetAccountHistory.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.hosting.getAccountHistory' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
