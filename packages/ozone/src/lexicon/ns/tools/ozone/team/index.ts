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
import * as ToolsOzoneTeamAddMember from '../../../../types/tools/ozone/team/addMember.js'
import * as ToolsOzoneTeamDeleteMember from '../../../../types/tools/ozone/team/deleteMember.js'
import * as ToolsOzoneTeamListMembers from '../../../../types/tools/ozone/team/listMembers.js'
import * as ToolsOzoneTeamUpdateMember from '../../../../types/tools/ozone/team/updateMember.js'
import { Server } from '../../../../index.js'

export class ToolsOzoneTeamNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  addMember<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneTeamAddMember.QueryParams,
      ToolsOzoneTeamAddMember.HandlerInput,
      ToolsOzoneTeamAddMember.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.team.addMember' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteMember<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneTeamDeleteMember.QueryParams,
      ToolsOzoneTeamDeleteMember.HandlerInput,
      ToolsOzoneTeamDeleteMember.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.team.deleteMember' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listMembers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneTeamListMembers.QueryParams,
      ToolsOzoneTeamListMembers.HandlerInput,
      ToolsOzoneTeamListMembers.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.team.listMembers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateMember<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ToolsOzoneTeamUpdateMember.QueryParams,
      ToolsOzoneTeamUpdateMember.HandlerInput,
      ToolsOzoneTeamUpdateMember.HandlerOutput
    >,
  ) {
    const nsid = 'tools.ozone.team.updateMember' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
