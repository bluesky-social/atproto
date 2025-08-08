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
import * as AppBskyActorGetPreferences from '../../../../types/app/bsky/actor/getPreferences.js'
import * as AppBskyActorGetProfile from '../../../../types/app/bsky/actor/getProfile.js'
import * as AppBskyActorGetProfiles from '../../../../types/app/bsky/actor/getProfiles.js'
import * as AppBskyActorGetSuggestions from '../../../../types/app/bsky/actor/getSuggestions.js'
import * as AppBskyActorProfile from '../../../../types/app/bsky/actor/profile.js'
import * as AppBskyActorPutPreferences from '../../../../types/app/bsky/actor/putPreferences.js'
import * as AppBskyActorSearchActors from '../../../../types/app/bsky/actor/searchActors.js'
import * as AppBskyActorSearchActorsTypeahead from '../../../../types/app/bsky/actor/searchActorsTypeahead.js'
import * as AppBskyActorStatus from '../../../../types/app/bsky/actor/status.js'
import { Server } from '../../../../index.js'

export class AppBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetPreferences.QueryParams,
      AppBskyActorGetPreferences.HandlerInput,
      AppBskyActorGetPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetProfile.QueryParams,
      AppBskyActorGetProfile.HandlerInput,
      AppBskyActorGetProfile.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getProfiles<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetProfiles.QueryParams,
      AppBskyActorGetProfiles.HandlerInput,
      AppBskyActorGetProfiles.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getProfiles' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorGetSuggestions.QueryParams,
      AppBskyActorGetSuggestions.HandlerInput,
      AppBskyActorGetSuggestions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.getSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorPutPreferences.QueryParams,
      AppBskyActorPutPreferences.HandlerInput,
      AppBskyActorPutPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.putPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorSearchActors.QueryParams,
      AppBskyActorSearchActors.HandlerInput,
      AppBskyActorSearchActors.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActorsTypeahead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyActorSearchActorsTypeahead.QueryParams,
      AppBskyActorSearchActorsTypeahead.HandlerInput,
      AppBskyActorSearchActorsTypeahead.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.actor.searchActorsTypeahead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
