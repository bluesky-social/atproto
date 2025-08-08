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
import * as ToolsOzoneSignatureFindCorrelation from '../../../../types/tools/ozone/signature/findCorrelation.js'
import * as ToolsOzoneSignatureFindRelatedAccounts from '../../../../types/tools/ozone/signature/findRelatedAccounts.js'
import * as ToolsOzoneSignatureSearchAccounts from '../../../../types/tools/ozone/signature/searchAccounts.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneSignatureNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  findCorrelation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSignatureFindCorrelation.QueryParams,
      ToolsOzoneSignatureFindCorrelation.HandlerInput,
      ToolsOzoneSignatureFindCorrelation.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.signature.findCorrelation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  findRelatedAccounts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSignatureFindRelatedAccounts.QueryParams,
      ToolsOzoneSignatureFindRelatedAccounts.HandlerInput,
      ToolsOzoneSignatureFindRelatedAccounts.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.signature.findRelatedAccounts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchAccounts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSignatureSearchAccounts.QueryParams,
      ToolsOzoneSignatureSearchAccounts.HandlerInput,
      ToolsOzoneSignatureSearchAccounts.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.signature.searchAccounts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
