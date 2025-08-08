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
import * as ToolsOzoneModerationEmitEvent from '../../../../types/tools/ozone/moderation/emitEvent.js'
import * as ToolsOzoneModerationGetAccountTimeline from '../../../../types/tools/ozone/moderation/getAccountTimeline.js'
import * as ToolsOzoneModerationGetEvent from '../../../../types/tools/ozone/moderation/getEvent.js'
import * as ToolsOzoneModerationGetRecord from '../../../../types/tools/ozone/moderation/getRecord.js'
import * as ToolsOzoneModerationGetRecords from '../../../../types/tools/ozone/moderation/getRecords.js'
import * as ToolsOzoneModerationGetRepo from '../../../../types/tools/ozone/moderation/getRepo.js'
import * as ToolsOzoneModerationGetReporterStats from '../../../../types/tools/ozone/moderation/getReporterStats.js'
import * as ToolsOzoneModerationGetRepos from '../../../../types/tools/ozone/moderation/getRepos.js'
import * as ToolsOzoneModerationGetSubjects from '../../../../types/tools/ozone/moderation/getSubjects.js'
import * as ToolsOzoneModerationQueryEvents from '../../../../types/tools/ozone/moderation/queryEvents.js'
import * as ToolsOzoneModerationQueryStatuses from '../../../../types/tools/ozone/moderation/queryStatuses.js'
import * as ToolsOzoneModerationSearchRepos from '../../../../types/tools/ozone/moderation/searchRepos.js'

export class ToolsOzoneModerationNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  emitEvent(
    data?: ToolsOzoneModerationEmitEvent.InputSchema,
    opts?: ToolsOzoneModerationEmitEvent.CallOptions,
  ): Promise<ToolsOzoneModerationEmitEvent.Response> {
    return this._client
      .call('tools.ozone.moderation.emitEvent', opts?.qp, data, opts)
      .catch((e) => {
        throw ToolsOzoneModerationEmitEvent.toKnownErr(e)
      })
  }

  getAccountTimeline(
    params?: ToolsOzoneModerationGetAccountTimeline.QueryParams,
    opts?: ToolsOzoneModerationGetAccountTimeline.CallOptions,
  ): Promise<ToolsOzoneModerationGetAccountTimeline.Response> {
    return this._client
      .call(
        'tools.ozone.moderation.getAccountTimeline',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw ToolsOzoneModerationGetAccountTimeline.toKnownErr(e)
      })
  }

  getEvent(
    params?: ToolsOzoneModerationGetEvent.QueryParams,
    opts?: ToolsOzoneModerationGetEvent.CallOptions,
  ): Promise<ToolsOzoneModerationGetEvent.Response> {
    return this._client.call(
      'tools.ozone.moderation.getEvent',
      params,
      undefined,
      opts,
    )
  }

  getRecord(
    params?: ToolsOzoneModerationGetRecord.QueryParams,
    opts?: ToolsOzoneModerationGetRecord.CallOptions,
  ): Promise<ToolsOzoneModerationGetRecord.Response> {
    return this._client
      .call('tools.ozone.moderation.getRecord', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneModerationGetRecord.toKnownErr(e)
      })
  }

  getRecords(
    params?: ToolsOzoneModerationGetRecords.QueryParams,
    opts?: ToolsOzoneModerationGetRecords.CallOptions,
  ): Promise<ToolsOzoneModerationGetRecords.Response> {
    return this._client.call(
      'tools.ozone.moderation.getRecords',
      params,
      undefined,
      opts,
    )
  }

  getRepo(
    params?: ToolsOzoneModerationGetRepo.QueryParams,
    opts?: ToolsOzoneModerationGetRepo.CallOptions,
  ): Promise<ToolsOzoneModerationGetRepo.Response> {
    return this._client
      .call('tools.ozone.moderation.getRepo', params, undefined, opts)
      .catch((e) => {
        throw ToolsOzoneModerationGetRepo.toKnownErr(e)
      })
  }

  getReporterStats(
    params?: ToolsOzoneModerationGetReporterStats.QueryParams,
    opts?: ToolsOzoneModerationGetReporterStats.CallOptions,
  ): Promise<ToolsOzoneModerationGetReporterStats.Response> {
    return this._client.call(
      'tools.ozone.moderation.getReporterStats',
      params,
      undefined,
      opts,
    )
  }

  getRepos(
    params?: ToolsOzoneModerationGetRepos.QueryParams,
    opts?: ToolsOzoneModerationGetRepos.CallOptions,
  ): Promise<ToolsOzoneModerationGetRepos.Response> {
    return this._client.call(
      'tools.ozone.moderation.getRepos',
      params,
      undefined,
      opts,
    )
  }

  getSubjects(
    params?: ToolsOzoneModerationGetSubjects.QueryParams,
    opts?: ToolsOzoneModerationGetSubjects.CallOptions,
  ): Promise<ToolsOzoneModerationGetSubjects.Response> {
    return this._client.call(
      'tools.ozone.moderation.getSubjects',
      params,
      undefined,
      opts,
    )
  }

  queryEvents(
    params?: ToolsOzoneModerationQueryEvents.QueryParams,
    opts?: ToolsOzoneModerationQueryEvents.CallOptions,
  ): Promise<ToolsOzoneModerationQueryEvents.Response> {
    return this._client.call(
      'tools.ozone.moderation.queryEvents',
      params,
      undefined,
      opts,
    )
  }

  queryStatuses(
    params?: ToolsOzoneModerationQueryStatuses.QueryParams,
    opts?: ToolsOzoneModerationQueryStatuses.CallOptions,
  ): Promise<ToolsOzoneModerationQueryStatuses.Response> {
    return this._client.call(
      'tools.ozone.moderation.queryStatuses',
      params,
      undefined,
      opts,
    )
  }

  searchRepos(
    params?: ToolsOzoneModerationSearchRepos.QueryParams,
    opts?: ToolsOzoneModerationSearchRepos.CallOptions,
  ): Promise<ToolsOzoneModerationSearchRepos.Response> {
    return this._client.call(
      'tools.ozone.moderation.searchRepos',
      params,
      undefined,
      opts,
    )
  }
}
