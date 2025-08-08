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
import * as ToolsOzoneSetAddValues from '../../../../types/tools/ozone/set/addValues.js'
import * as ToolsOzoneSetDeleteSet from '../../../../types/tools/ozone/set/deleteSet.js'
import * as ToolsOzoneSetDeleteValues from '../../../../types/tools/ozone/set/deleteValues.js'
import * as ToolsOzoneSetGetValues from '../../../../types/tools/ozone/set/getValues.js'
import * as ToolsOzoneSetQuerySets from '../../../../types/tools/ozone/set/querySets.js'
import * as ToolsOzoneSetUpsertSet from '../../../../types/tools/ozone/set/upsertSet.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneSetNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  addValues<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetAddValues.QueryParams,
      ToolsOzoneSetAddValues.HandlerInput,
      ToolsOzoneSetAddValues.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.addValues' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteSet<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetDeleteSet.QueryParams,
      ToolsOzoneSetDeleteSet.HandlerInput,
      ToolsOzoneSetDeleteSet.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.deleteSet' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteValues<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetDeleteValues.QueryParams,
      ToolsOzoneSetDeleteValues.HandlerInput,
      ToolsOzoneSetDeleteValues.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.deleteValues' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getValues<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetGetValues.QueryParams,
      ToolsOzoneSetGetValues.HandlerInput,
      ToolsOzoneSetGetValues.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.getValues' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  querySets<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetQuerySets.QueryParams,
      ToolsOzoneSetQuerySets.HandlerInput,
      ToolsOzoneSetQuerySets.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.querySets' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  upsertSet<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSetUpsertSet.QueryParams,
      ToolsOzoneSetUpsertSet.HandlerInput,
      ToolsOzoneSetUpsertSet.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.set.upsertSet' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
