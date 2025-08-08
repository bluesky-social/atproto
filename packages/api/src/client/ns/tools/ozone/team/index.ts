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
import * as ToolsOzoneTeamAddMember from '../../../../types/tools/ozone/team/addMember.js'
import * as ToolsOzoneTeamDeleteMember from '../../../../types/tools/ozone/team/deleteMember.js'
import * as ToolsOzoneTeamListMembers from '../../../../types/tools/ozone/team/listMembers.js'
import * as ToolsOzoneTeamUpdateMember from '../../../../types/tools/ozone/team/updateMember.js'

export class ToolsOzoneTeamNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addMember(
    data?: ToolsOzoneTeamAddMember.InputSchema,
    opts?: ToolsOzoneTeamAddMember.CallOptions,
  ): Promise<ToolsOzoneTeamAddMember.Response> {
    return this._client
      .call('tools.ozone.team.addMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamAddMember.toKnownErr(e)
      })
  }

  deleteMember(
    data?: ToolsOzoneTeamDeleteMember.InputSchema,
    opts?: ToolsOzoneTeamDeleteMember.CallOptions,
  ): Promise<ToolsOzoneTeamDeleteMember.Response> {
    return this._client
      .call('tools.ozone.team.deleteMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamDeleteMember.toKnownErr(e)
      })
  }

  listMembers(
    params?: ToolsOzoneTeamListMembers.QueryParams,
    opts?: ToolsOzoneTeamListMembers.CallOptions,
  ): Promise<ToolsOzoneTeamListMembers.Response> {
    return this._client.call(
      'tools.ozone.team.listMembers',
      params,
      undefined,
      opts,
    )
  }

  updateMember(
    data?: ToolsOzoneTeamUpdateMember.InputSchema,
    opts?: ToolsOzoneTeamUpdateMember.CallOptions,
  ): Promise<ToolsOzoneTeamUpdateMember.Response> {
    return this._client
      .call('tools.ozone.team.updateMember', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneTeamUpdateMember.toKnownErr(e)
      })
  }
}
