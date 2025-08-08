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
import * as AppBskyGraphBlock from '../../../../types/app/bsky/graph/block.js'
import * as AppBskyGraphFollow from '../../../../types/app/bsky/graph/follow.js'
import * as AppBskyGraphGetActorStarterPacks from '../../../../types/app/bsky/graph/getActorStarterPacks.js'
import * as AppBskyGraphGetBlocks from '../../../../types/app/bsky/graph/getBlocks.js'
import * as AppBskyGraphGetFollowers from '../../../../types/app/bsky/graph/getFollowers.js'
import * as AppBskyGraphGetFollows from '../../../../types/app/bsky/graph/getFollows.js'
import * as AppBskyGraphGetKnownFollowers from '../../../../types/app/bsky/graph/getKnownFollowers.js'
import * as AppBskyGraphGetList from '../../../../types/app/bsky/graph/getList.js'
import * as AppBskyGraphGetListBlocks from '../../../../types/app/bsky/graph/getListBlocks.js'
import * as AppBskyGraphGetListMutes from '../../../../types/app/bsky/graph/getListMutes.js'
import * as AppBskyGraphGetLists from '../../../../types/app/bsky/graph/getLists.js'
import * as AppBskyGraphGetListsWithMembership from '../../../../types/app/bsky/graph/getListsWithMembership.js'
import * as AppBskyGraphGetMutes from '../../../../types/app/bsky/graph/getMutes.js'
import * as AppBskyGraphGetRelationships from '../../../../types/app/bsky/graph/getRelationships.js'
import * as AppBskyGraphGetStarterPack from '../../../../types/app/bsky/graph/getStarterPack.js'
import * as AppBskyGraphGetStarterPacks from '../../../../types/app/bsky/graph/getStarterPacks.js'
import * as AppBskyGraphGetStarterPacksWithMembership from '../../../../types/app/bsky/graph/getStarterPacksWithMembership.js'
import * as AppBskyGraphGetSuggestedFollowsByActor from '../../../../types/app/bsky/graph/getSuggestedFollowsByActor.js'
import * as AppBskyGraphList from '../../../../types/app/bsky/graph/list.js'
import * as AppBskyGraphListblock from '../../../../types/app/bsky/graph/listblock.js'
import * as AppBskyGraphListitem from '../../../../types/app/bsky/graph/listitem.js'
import * as AppBskyGraphMuteActor from '../../../../types/app/bsky/graph/muteActor.js'
import * as AppBskyGraphMuteActorList from '../../../../types/app/bsky/graph/muteActorList.js'
import * as AppBskyGraphMuteThread from '../../../../types/app/bsky/graph/muteThread.js'
import * as AppBskyGraphSearchStarterPacks from '../../../../types/app/bsky/graph/searchStarterPacks.js'
import * as AppBskyGraphStarterpack from '../../../../types/app/bsky/graph/starterpack.js'
import * as AppBskyGraphUnmuteActor from '../../../../types/app/bsky/graph/unmuteActor.js'
import * as AppBskyGraphUnmuteActorList from '../../../../types/app/bsky/graph/unmuteActorList.js'
import * as AppBskyGraphUnmuteThread from '../../../../types/app/bsky/graph/unmuteThread.js'
import * as AppBskyGraphVerification from '../../../../types/app/bsky/graph/verification.js'
import { Server } from '../../../../index.js'

export class AppBskyGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getActorStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetActorStarterPacks.QueryParams,
      AppBskyGraphGetActorStarterPacks.HandlerInput,
      AppBskyGraphGetActorStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getActorStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetBlocks.QueryParams,
      AppBskyGraphGetBlocks.HandlerInput,
      AppBskyGraphGetBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetFollowers.QueryParams,
      AppBskyGraphGetFollowers.HandlerInput,
      AppBskyGraphGetFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetFollows.QueryParams,
      AppBskyGraphGetFollows.HandlerInput,
      AppBskyGraphGetFollows.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getKnownFollowers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetKnownFollowers.QueryParams,
      AppBskyGraphGetKnownFollowers.HandlerInput,
      AppBskyGraphGetKnownFollowers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getKnownFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetList.QueryParams,
      AppBskyGraphGetList.HandlerInput,
      AppBskyGraphGetList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListBlocks.QueryParams,
      AppBskyGraphGetListBlocks.HandlerInput,
      AppBskyGraphGetListBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListMutes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListMutes.QueryParams,
      AppBskyGraphGetListMutes.HandlerInput,
      AppBskyGraphGetListMutes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListMutes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetLists.QueryParams,
      AppBskyGraphGetLists.HandlerInput,
      AppBskyGraphGetLists.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getLists' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListsWithMembership<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetListsWithMembership.QueryParams,
      AppBskyGraphGetListsWithMembership.HandlerInput,
      AppBskyGraphGetListsWithMembership.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getListsWithMembership' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getMutes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetMutes.QueryParams,
      AppBskyGraphGetMutes.HandlerInput,
      AppBskyGraphGetMutes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getMutes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRelationships<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetRelationships.QueryParams,
      AppBskyGraphGetRelationships.HandlerInput,
      AppBskyGraphGetRelationships.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getRelationships' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPack<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPack.QueryParams,
      AppBskyGraphGetStarterPack.HandlerInput,
      AppBskyGraphGetStarterPack.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPack' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPacks.QueryParams,
      AppBskyGraphGetStarterPacks.HandlerInput,
      AppBskyGraphGetStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getStarterPacksWithMembership<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetStarterPacksWithMembership.QueryParams,
      AppBskyGraphGetStarterPacksWithMembership.HandlerInput,
      AppBskyGraphGetStarterPacksWithMembership.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getStarterPacksWithMembership' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFollowsByActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphGetSuggestedFollowsByActor.QueryParams,
      AppBskyGraphGetSuggestedFollowsByActor.HandlerInput,
      AppBskyGraphGetSuggestedFollowsByActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.getSuggestedFollowsByActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteActor.QueryParams,
      AppBskyGraphMuteActor.HandlerInput,
      AppBskyGraphMuteActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteActorList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteActorList.QueryParams,
      AppBskyGraphMuteActorList.HandlerInput,
      AppBskyGraphMuteActorList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteActorList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  muteThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphMuteThread.QueryParams,
      AppBskyGraphMuteThread.HandlerInput,
      AppBskyGraphMuteThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.muteThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphSearchStarterPacks.QueryParams,
      AppBskyGraphSearchStarterPacks.HandlerInput,
      AppBskyGraphSearchStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.searchStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteActor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteActor.QueryParams,
      AppBskyGraphUnmuteActor.HandlerInput,
      AppBskyGraphUnmuteActor.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteActor' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteActorList<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteActorList.QueryParams,
      AppBskyGraphUnmuteActorList.HandlerInput,
      AppBskyGraphUnmuteActorList.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteActorList' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unmuteThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyGraphUnmuteThread.QueryParams,
      AppBskyGraphUnmuteThread.HandlerInput,
      AppBskyGraphUnmuteThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.graph.unmuteThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
