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
import * as ToolsOzoneSettingListOptions from '../../../../types/tools/ozone/setting/listOptions.js'
import * as ToolsOzoneSettingRemoveOptions from '../../../../types/tools/ozone/setting/removeOptions.js'
import * as ToolsOzoneSettingUpsertOption from '../../../../types/tools/ozone/setting/upsertOption.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneSettingNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  listOptions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSettingListOptions.QueryParams,
      ToolsOzoneSettingListOptions.HandlerInput,
      ToolsOzoneSettingListOptions.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.setting.listOptions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  removeOptions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSettingRemoveOptions.QueryParams,
      ToolsOzoneSettingRemoveOptions.HandlerInput,
      ToolsOzoneSettingRemoveOptions.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.setting.removeOptions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  upsertOption<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneSettingUpsertOption.QueryParams,
      ToolsOzoneSettingUpsertOption.HandlerInput,
      ToolsOzoneSettingUpsertOption.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.setting.upsertOption' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
