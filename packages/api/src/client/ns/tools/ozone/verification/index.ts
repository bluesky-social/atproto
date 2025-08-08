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
import * as ToolsOzoneVerificationGrantVerifications from '../../../../types/tools/ozone/verification/grantVerifications.js'
import * as ToolsOzoneVerificationListVerifications from '../../../../types/tools/ozone/verification/listVerifications.js'
import * as ToolsOzoneVerificationRevokeVerifications from '../../../../types/tools/ozone/verification/revokeVerifications.js'

export class ToolsOzoneVerificationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  grantVerifications(
    data?: ToolsOzoneVerificationGrantVerifications.InputSchema,
    opts?: ToolsOzoneVerificationGrantVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationGrantVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.grantVerifications',
      opts?.qp,
      data,
      opts,
    )
  }

  listVerifications(
    params?: ToolsOzoneVerificationListVerifications.QueryParams,
    opts?: ToolsOzoneVerificationListVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationListVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.listVerifications',
      params,
      undefined,
      opts,
    )
  }

  revokeVerifications(
    data?: ToolsOzoneVerificationRevokeVerifications.InputSchema,
    opts?: ToolsOzoneVerificationRevokeVerifications.CallOptions,
  ): Promise<ToolsOzoneVerificationRevokeVerifications.Response> {
    return this._client.call(
      'tools.ozone.verification.revokeVerifications',
      opts?.qp,
      data,
      opts,
    )
  }
}
