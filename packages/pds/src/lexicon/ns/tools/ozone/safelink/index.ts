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
import * as ToolsOzoneSafelinkAddRule from '../../../../types/tools/ozone/safelink/addRule.js'
import * as ToolsOzoneSafelinkQueryEvents from '../../../../types/tools/ozone/safelink/queryEvents.js'
import * as ToolsOzoneSafelinkQueryRules from '../../../../types/tools/ozone/safelink/queryRules.js'
import * as ToolsOzoneSafelinkRemoveRule from '../../../../types/tools/ozone/safelink/removeRule.js'
import * as ToolsOzoneSafelinkUpdateRule from '../../../../types/tools/ozone/safelink/updateRule.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneSafelinkNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  addRule<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSafelinkAddRule.QueryParams,
      ToolsOzoneSafelinkAddRule.HandlerInput,
      ToolsOzoneSafelinkAddRule.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.safelink.addRule' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  queryEvents<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSafelinkQueryEvents.QueryParams,
      ToolsOzoneSafelinkQueryEvents.HandlerInput,
      ToolsOzoneSafelinkQueryEvents.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.safelink.queryEvents' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  queryRules<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSafelinkQueryRules.QueryParams,
      ToolsOzoneSafelinkQueryRules.HandlerInput,
      ToolsOzoneSafelinkQueryRules.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.safelink.queryRules' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  removeRule<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSafelinkRemoveRule.QueryParams,
      ToolsOzoneSafelinkRemoveRule.HandlerInput,
      ToolsOzoneSafelinkRemoveRule.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.safelink.removeRule' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateRule<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSafelinkUpdateRule.QueryParams,
      ToolsOzoneSafelinkUpdateRule.HandlerInput,
      ToolsOzoneSafelinkUpdateRule.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.safelink.updateRule' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
