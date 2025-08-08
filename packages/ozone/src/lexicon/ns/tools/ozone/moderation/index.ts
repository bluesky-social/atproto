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
import { Server } from '../../../../index.js'

export class ToolsOzoneModerationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  emitEvent<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationEmitEvent.QueryParams,
      ToolsOzoneModerationEmitEvent.HandlerInput,
      ToolsOzoneModerationEmitEvent.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.emitEvent' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAccountTimeline<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetAccountTimeline.QueryParams,
      ToolsOzoneModerationGetAccountTimeline.HandlerInput,
      ToolsOzoneModerationGetAccountTimeline.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getAccountTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getEvent<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetEvent.QueryParams,
      ToolsOzoneModerationGetEvent.HandlerInput,
      ToolsOzoneModerationGetEvent.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getEvent' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetRecord.QueryParams,
      ToolsOzoneModerationGetRecord.HandlerInput,
      ToolsOzoneModerationGetRecord.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecords<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetRecords.QueryParams,
      ToolsOzoneModerationGetRecords.HandlerInput,
      ToolsOzoneModerationGetRecords.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getRecords' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetRepo.QueryParams,
      ToolsOzoneModerationGetRepo.HandlerInput,
      ToolsOzoneModerationGetRepo.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getReporterStats<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetReporterStats.QueryParams,
      ToolsOzoneModerationGetReporterStats.HandlerInput,
      ToolsOzoneModerationGetReporterStats.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getReporterStats' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetRepos.QueryParams,
      ToolsOzoneModerationGetRepos.HandlerInput,
      ToolsOzoneModerationGetRepos.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getRepos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSubjects<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationGetSubjects.QueryParams,
      ToolsOzoneModerationGetSubjects.HandlerInput,
      ToolsOzoneModerationGetSubjects.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.getSubjects' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  queryEvents<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationQueryEvents.QueryParams,
      ToolsOzoneModerationQueryEvents.HandlerInput,
      ToolsOzoneModerationQueryEvents.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.queryEvents' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  queryStatuses<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationQueryStatuses.QueryParams,
      ToolsOzoneModerationQueryStatuses.HandlerInput,
      ToolsOzoneModerationQueryStatuses.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.queryStatuses' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchRepos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneModerationSearchRepos.QueryParams,
      ToolsOzoneModerationSearchRepos.HandlerInput,
      ToolsOzoneModerationSearchRepos.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.moderation.searchRepos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
