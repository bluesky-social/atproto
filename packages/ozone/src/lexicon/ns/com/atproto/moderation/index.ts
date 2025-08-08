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
import * as ComAtprotoModerationCreateReport from '../../../../types/com/atproto/moderation/createReport.js'
import { Server } from '../../../../index.js'

export class ComAtprotoModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createReport<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoModerationCreateReport.QueryParams,
      ComAtprotoModerationCreateReport.HandlerInput,
      ComAtprotoModerationCreateReport.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.moderation.createReport' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
