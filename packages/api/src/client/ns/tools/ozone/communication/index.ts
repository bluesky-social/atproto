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
import * as ToolsOzoneCommunicationCreateTemplate from '../../../../types/tools/ozone/communication/createTemplate.js'
import * as ToolsOzoneCommunicationDeleteTemplate from '../../../../types/tools/ozone/communication/deleteTemplate.js'
import * as ToolsOzoneCommunicationListTemplates from '../../../../types/tools/ozone/communication/listTemplates.js'
import * as ToolsOzoneCommunicationUpdateTemplate from '../../../../types/tools/ozone/communication/updateTemplate.js'

export class ToolsOzoneCommunicationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  createTemplate(
    data?: ToolsOzoneCommunicationCreateTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationCreateTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationCreateTemplate.Response> {
    return this._client
      .call('tools.ozone.communication.createTemplate', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneCommunicationCreateTemplate.toKnownErr(e)
      })
  }

  deleteTemplate(
    data?: ToolsOzoneCommunicationDeleteTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationDeleteTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationDeleteTemplate.Response> {
    return this._client.call(
      'tools.ozone.communication.deleteTemplate',
      opts?.qp,
      data,
      opts,
    )
  }

  listTemplates(
    params?: ToolsOzoneCommunicationListTemplates.QueryParams,
    opts?: ToolsOzoneCommunicationListTemplates.CallOptions,
  ): Promise<ToolsOzoneCommunicationListTemplates.Response> {
    return this._client.call(
      'tools.ozone.communication.listTemplates',
      params,
      undefined,
      opts,
    )
  }

  updateTemplate(
    data?: ToolsOzoneCommunicationUpdateTemplate.InputSchema,
    opts?: ToolsOzoneCommunicationUpdateTemplate.CallOptions,
  ): Promise<ToolsOzoneCommunicationUpdateTemplate.Response> {
    return this._client
      .call('tools.ozone.communication.updateTemplate', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneCommunicationUpdateTemplate.toKnownErr(e)
      })
  }
}
