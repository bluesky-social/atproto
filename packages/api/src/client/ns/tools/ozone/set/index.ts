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
import * as ToolsOzoneSetAddValues from '../../../../types/tools/ozone/set/addValues.js'
import * as ToolsOzoneSetDeleteSet from '../../../../types/tools/ozone/set/deleteSet.js'
import * as ToolsOzoneSetDeleteValues from '../../../../types/tools/ozone/set/deleteValues.js'
import * as ToolsOzoneSetGetValues from '../../../../types/tools/ozone/set/getValues.js'
import * as ToolsOzoneSetQuerySets from '../../../../types/tools/ozone/set/querySets.js'
import * as ToolsOzoneSetUpsertSet from '../../../../types/tools/ozone/set/upsertSet.js'

export class ToolsOzoneSetNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addValues(
    data?: ToolsOzoneSetAddValues.InputSchema,
    opts?: ToolsOzoneSetAddValues.CallOptions,
  ): Promise<ToolsOzoneSetAddValues.Response> {
    return this._client.call('tools.ozone.set.addValues', opts?.qp, data, opts)
  }

  deleteSet(
    data?: ToolsOzoneSetDeleteSet.InputSchema,
    opts?: ToolsOzoneSetDeleteSet.CallOptions,
  ): Promise<ToolsOzoneSetDeleteSet.Response> {
    return this._client
      .call('tools.ozone.set.deleteSet', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSetDeleteSet.toKnownErr(e)
      })
  }

  deleteValues(
    data?: ToolsOzoneSetDeleteValues.InputSchema,
    opts?: ToolsOzoneSetDeleteValues.CallOptions,
  ): Promise<ToolsOzoneSetDeleteValues.Response> {
    return this._client
      .call('tools.ozone.set.deleteValues', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSetDeleteValues.toKnownErr(e)
      })
  }

  getValues(
    params?: ToolsOzoneSetGetValues.QueryParams,
    opts?: ToolsOzoneSetGetValues.CallOptions,
  ): Promise<ToolsOzoneSetGetValues.Response> {
    return this._client
      .call('tools.ozone.set.getValues', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneSetGetValues.toKnownErr(e)
      })
  }

  querySets(
    params?: ToolsOzoneSetQuerySets.QueryParams,
    opts?: ToolsOzoneSetQuerySets.CallOptions,
  ): Promise<ToolsOzoneSetQuerySets.Response> {
    return this._client.call(
      'tools.ozone.set.querySets',
      params,
      undefined,
      opts,
    )
  }

  upsertSet(
    data?: ToolsOzoneSetUpsertSet.InputSchema,
    opts?: ToolsOzoneSetUpsertSet.CallOptions,
  ): Promise<ToolsOzoneSetUpsertSet.Response> {
    return this._client.call('tools.ozone.set.upsertSet', opts?.qp, data, opts)
  }
}
