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
import * as ToolsOzoneCommunicationCreateTemplate from '../../../../types/tools/ozone/communication/createTemplate.js'
import * as ToolsOzoneCommunicationDeleteTemplate from '../../../../types/tools/ozone/communication/deleteTemplate.js'
import * as ToolsOzoneCommunicationListTemplates from '../../../../types/tools/ozone/communication/listTemplates.js'
import * as ToolsOzoneCommunicationUpdateTemplate from '../../../../types/tools/ozone/communication/updateTemplate.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneCommunicationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  createTemplate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneCommunicationCreateTemplate.QueryParams,
      ToolsOzoneCommunicationCreateTemplate.HandlerInput,
      ToolsOzoneCommunicationCreateTemplate.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.communication.createTemplate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteTemplate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneCommunicationDeleteTemplate.QueryParams,
      ToolsOzoneCommunicationDeleteTemplate.HandlerInput,
      ToolsOzoneCommunicationDeleteTemplate.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.communication.deleteTemplate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listTemplates<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneCommunicationListTemplates.QueryParams,
      ToolsOzoneCommunicationListTemplates.HandlerInput,
      ToolsOzoneCommunicationListTemplates.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.communication.listTemplates' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateTemplate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneCommunicationUpdateTemplate.QueryParams,
      ToolsOzoneCommunicationUpdateTemplate.HandlerInput,
      ToolsOzoneCommunicationUpdateTemplate.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.communication.updateTemplate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
