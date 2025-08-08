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
import * as ToolsOzoneVerificationGrantVerifications from '../../../../types/tools/ozone/verification/grantVerifications.js'
import * as ToolsOzoneVerificationListVerifications from '../../../../types/tools/ozone/verification/listVerifications.js'
import * as ToolsOzoneVerificationRevokeVerifications from '../../../../types/tools/ozone/verification/revokeVerifications.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneVerificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  grantVerifications<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneVerificationGrantVerifications.QueryParams,
      ToolsOzoneVerificationGrantVerifications.HandlerInput,
      ToolsOzoneVerificationGrantVerifications.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.verification.grantVerifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listVerifications<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneVerificationListVerifications.QueryParams,
      ToolsOzoneVerificationListVerifications.HandlerInput,
      ToolsOzoneVerificationListVerifications.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.verification.listVerifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  revokeVerifications<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneVerificationRevokeVerifications.QueryParams,
      ToolsOzoneVerificationRevokeVerifications.HandlerInput,
      ToolsOzoneVerificationRevokeVerifications.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.verification.revokeVerifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
