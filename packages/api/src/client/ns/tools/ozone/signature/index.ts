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
import * as ToolsOzoneSignatureFindCorrelation from '../../../../types/tools/ozone/signature/findCorrelation.js'
import * as ToolsOzoneSignatureFindRelatedAccounts from '../../../../types/tools/ozone/signature/findRelatedAccounts.js'
import * as ToolsOzoneSignatureSearchAccounts from '../../../../types/tools/ozone/signature/searchAccounts.js'

export class ToolsOzoneSignatureNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  findCorrelation(
    params?: ToolsOzoneSignatureFindCorrelation.QueryParams,
    opts?: ToolsOzoneSignatureFindCorrelation.CallOptions,
  ): Promise<ToolsOzoneSignatureFindCorrelation.Response> {
    return this._client.call(
      'tools.ozone.signature.findCorrelation',
      params,
      undefined,
      opts,
    )
  }

  findRelatedAccounts(
    params?: ToolsOzoneSignatureFindRelatedAccounts.QueryParams,
    opts?: ToolsOzoneSignatureFindRelatedAccounts.CallOptions,
  ): Promise<ToolsOzoneSignatureFindRelatedAccounts.Response> {
    return this._client.call(
      'tools.ozone.signature.findRelatedAccounts',
      params,
      undefined,
      opts,
    )
  }

  searchAccounts(
    params?: ToolsOzoneSignatureSearchAccounts.QueryParams,
    opts?: ToolsOzoneSignatureSearchAccounts.CallOptions,
  ): Promise<ToolsOzoneSignatureSearchAccounts.Response> {
    return this._client.call(
      'tools.ozone.signature.searchAccounts',
      params,
      undefined,
      opts,
    )
  }
}
