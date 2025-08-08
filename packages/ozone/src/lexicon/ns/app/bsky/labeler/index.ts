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
import * as AppBskyLabelerGetServices from '../../../../types/app/bsky/labeler/getServices.js'
import * as AppBskyLabelerService from '../../../../types/app/bsky/labeler/service.js'
import { Server } from '../../../../index.js'

export class AppBskyLabelerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getServices<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyLabelerGetServices.QueryParams,
      AppBskyLabelerGetServices.HandlerInput,
      AppBskyLabelerGetServices.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.labeler.getServices' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
