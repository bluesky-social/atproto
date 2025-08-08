/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from '../../../../lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from '../../../../util.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'
import * as ToolsOzoneSettingListOptions from '../../../../types/tools/ozone/setting/listOptions.js'
import * as ToolsOzoneSettingRemoveOptions from '../../../../types/tools/ozone/setting/removeOptions.js'
import * as ToolsOzoneSettingUpsertOption from '../../../../types/tools/ozone/setting/upsertOption.js'

export class ToolsOzoneSettingNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  listOptions(
    params?: ToolsOzoneSettingListOptions.QueryParams,
    opts?: ToolsOzoneSettingListOptions.CallOptions,
  ): Promise<ToolsOzoneSettingListOptions.Response> {
    return this._client.call(
      'tools.ozone.setting.listOptions',
      params,
      undefined,
      opts,
    )
  }

  removeOptions(
    data?: ToolsOzoneSettingRemoveOptions.InputSchema,
    opts?: ToolsOzoneSettingRemoveOptions.CallOptions,
  ): Promise<ToolsOzoneSettingRemoveOptions.Response> {
    return this._client.call(
      'tools.ozone.setting.removeOptions',
      opts?.qp,
      data,
      opts,
    )
  }

  upsertOption(
    data?: ToolsOzoneSettingUpsertOption.InputSchema,
    opts?: ToolsOzoneSettingUpsertOption.CallOptions,
  ): Promise<ToolsOzoneSettingUpsertOption.Response> {
    return this._client.call(
      'tools.ozone.setting.upsertOption',
      opts?.qp,
      data,
      opts,
    )
  }
}
