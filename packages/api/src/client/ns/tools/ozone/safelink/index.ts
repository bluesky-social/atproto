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
import * as ToolsOzoneSafelinkAddRule from '../../../../types/tools/ozone/safelink/addRule.js'
import * as ToolsOzoneSafelinkQueryEvents from '../../../../types/tools/ozone/safelink/queryEvents.js'
import * as ToolsOzoneSafelinkQueryRules from '../../../../types/tools/ozone/safelink/queryRules.js'
import * as ToolsOzoneSafelinkRemoveRule from '../../../../types/tools/ozone/safelink/removeRule.js'
import * as ToolsOzoneSafelinkUpdateRule from '../../../../types/tools/ozone/safelink/updateRule.js'

export class ToolsOzoneSafelinkNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  addRule(
    data?: ToolsOzoneSafelinkAddRule.InputSchema,
    opts?: ToolsOzoneSafelinkAddRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkAddRule.Response> {
    return this._client
      .call('tools.ozone.safelink.addRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkAddRule.toKnownErr(e)
      })
  }

  queryEvents(
    data?: ToolsOzoneSafelinkQueryEvents.InputSchema,
    opts?: ToolsOzoneSafelinkQueryEvents.CallOptions,
  ): Promise<ToolsOzoneSafelinkQueryEvents.Response> {
    return this._client.call(
      'tools.ozone.safelink.queryEvents',
      opts?.qp,
      data,
      opts,
    )
  }

  queryRules(
    data?: ToolsOzoneSafelinkQueryRules.InputSchema,
    opts?: ToolsOzoneSafelinkQueryRules.CallOptions,
  ): Promise<ToolsOzoneSafelinkQueryRules.Response> {
    return this._client.call(
      'tools.ozone.safelink.queryRules',
      opts?.qp,
      data,
      opts,
    )
  }

  removeRule(
    data?: ToolsOzoneSafelinkRemoveRule.InputSchema,
    opts?: ToolsOzoneSafelinkRemoveRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkRemoveRule.Response> {
    return this._client
      .call('tools.ozone.safelink.removeRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkRemoveRule.toKnownErr(e)
      })
  }

  updateRule(
    data?: ToolsOzoneSafelinkUpdateRule.InputSchema,
    opts?: ToolsOzoneSafelinkUpdateRule.CallOptions,
  ): Promise<ToolsOzoneSafelinkUpdateRule.Response> {
    return this._client
      .call('tools.ozone.safelink.updateRule', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneSafelinkUpdateRule.toKnownErr(e)
      })
  }
}
