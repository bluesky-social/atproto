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
import * as AppBskyUnspeccedGetAgeAssuranceState from '../../../../types/app/bsky/unspecced/getAgeAssuranceState.js'
import * as AppBskyUnspeccedGetConfig from '../../../../types/app/bsky/unspecced/getConfig.js'
import * as AppBskyUnspeccedGetPopularFeedGenerators from '../../../../types/app/bsky/unspecced/getPopularFeedGenerators.js'
import * as AppBskyUnspeccedGetPostThreadOtherV2 from '../../../../types/app/bsky/unspecced/getPostThreadOtherV2.js'
import * as AppBskyUnspeccedGetPostThreadV2 from '../../../../types/app/bsky/unspecced/getPostThreadV2.js'
import * as AppBskyUnspeccedGetSuggestedFeeds from '../../../../types/app/bsky/unspecced/getSuggestedFeeds.js'
import * as AppBskyUnspeccedGetSuggestedFeedsSkeleton from '../../../../types/app/bsky/unspecced/getSuggestedFeedsSkeleton.js'
import * as AppBskyUnspeccedGetSuggestedStarterPacks from '../../../../types/app/bsky/unspecced/getSuggestedStarterPacks.js'
import * as AppBskyUnspeccedGetSuggestedStarterPacksSkeleton from '../../../../types/app/bsky/unspecced/getSuggestedStarterPacksSkeleton.js'
import * as AppBskyUnspeccedGetSuggestedUsers from '../../../../types/app/bsky/unspecced/getSuggestedUsers.js'
import * as AppBskyUnspeccedGetSuggestedUsersSkeleton from '../../../../types/app/bsky/unspecced/getSuggestedUsersSkeleton.js'
import * as AppBskyUnspeccedGetSuggestionsSkeleton from '../../../../types/app/bsky/unspecced/getSuggestionsSkeleton.js'
import * as AppBskyUnspeccedGetTaggedSuggestions from '../../../../types/app/bsky/unspecced/getTaggedSuggestions.js'
import * as AppBskyUnspeccedGetTrendingTopics from '../../../../types/app/bsky/unspecced/getTrendingTopics.js'
import * as AppBskyUnspeccedGetTrends from '../../../../types/app/bsky/unspecced/getTrends.js'
import * as AppBskyUnspeccedGetTrendsSkeleton from '../../../../types/app/bsky/unspecced/getTrendsSkeleton.js'
import * as AppBskyUnspeccedInitAgeAssurance from '../../../../types/app/bsky/unspecced/initAgeAssurance.js'
import * as AppBskyUnspeccedSearchActorsSkeleton from '../../../../types/app/bsky/unspecced/searchActorsSkeleton.js'
import * as AppBskyUnspeccedSearchPostsSkeleton from '../../../../types/app/bsky/unspecced/searchPostsSkeleton.js'
import * as AppBskyUnspeccedSearchStarterPacksSkeleton from '../../../../types/app/bsky/unspecced/searchStarterPacksSkeleton.js'
import { Server } from '../../../../index.js'

export class AppBskyUnspeccedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAgeAssuranceState<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetAgeAssuranceState.QueryParams,
      AppBskyUnspeccedGetAgeAssuranceState.HandlerInput,
      AppBskyUnspeccedGetAgeAssuranceState.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getAgeAssuranceState' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getConfig<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetConfig.QueryParams,
      AppBskyUnspeccedGetConfig.HandlerInput,
      AppBskyUnspeccedGetConfig.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getConfig' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPopularFeedGenerators<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPopularFeedGenerators.QueryParams,
      AppBskyUnspeccedGetPopularFeedGenerators.HandlerInput,
      AppBskyUnspeccedGetPopularFeedGenerators.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPopularFeedGenerators' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThreadOtherV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPostThreadOtherV2.QueryParams,
      AppBskyUnspeccedGetPostThreadOtherV2.HandlerInput,
      AppBskyUnspeccedGetPostThreadOtherV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPostThreadOtherV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThreadV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetPostThreadV2.QueryParams,
      AppBskyUnspeccedGetPostThreadV2.HandlerInput,
      AppBskyUnspeccedGetPostThreadV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getPostThreadV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedFeeds.QueryParams,
      AppBskyUnspeccedGetSuggestedFeeds.HandlerInput,
      AppBskyUnspeccedGetSuggestedFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeedsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedFeedsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedFeedsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedStarterPacks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedStarterPacks.QueryParams,
      AppBskyUnspeccedGetSuggestedStarterPacks.HandlerInput,
      AppBskyUnspeccedGetSuggestedStarterPacks.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedStarterPacks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedStarterPacksSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedStarterPacksSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedUsers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedUsers.QueryParams,
      AppBskyUnspeccedGetSuggestedUsers.HandlerInput,
      AppBskyUnspeccedGetSuggestedUsers.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedUsers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedUsersSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestedUsersSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestedUsersSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestionsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetSuggestionsSkeleton.QueryParams,
      AppBskyUnspeccedGetSuggestionsSkeleton.HandlerInput,
      AppBskyUnspeccedGetSuggestionsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getSuggestionsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTaggedSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTaggedSuggestions.QueryParams,
      AppBskyUnspeccedGetTaggedSuggestions.HandlerInput,
      AppBskyUnspeccedGetTaggedSuggestions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTaggedSuggestions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrendingTopics<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrendingTopics.QueryParams,
      AppBskyUnspeccedGetTrendingTopics.HandlerInput,
      AppBskyUnspeccedGetTrendingTopics.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrendingTopics' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrends<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrends.QueryParams,
      AppBskyUnspeccedGetTrends.HandlerInput,
      AppBskyUnspeccedGetTrends.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrends' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTrendsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedGetTrendsSkeleton.QueryParams,
      AppBskyUnspeccedGetTrendsSkeleton.HandlerInput,
      AppBskyUnspeccedGetTrendsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.getTrendsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  initAgeAssurance<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedInitAgeAssurance.QueryParams,
      AppBskyUnspeccedInitAgeAssurance.HandlerInput,
      AppBskyUnspeccedInitAgeAssurance.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.initAgeAssurance' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActorsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchActorsSkeleton.QueryParams,
      AppBskyUnspeccedSearchActorsSkeleton.HandlerInput,
      AppBskyUnspeccedSearchActorsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchActorsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchPostsSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchPostsSkeleton.QueryParams,
      AppBskyUnspeccedSearchPostsSkeleton.HandlerInput,
      AppBskyUnspeccedSearchPostsSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchPostsSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchStarterPacksSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyUnspeccedSearchStarterPacksSkeleton.QueryParams,
      AppBskyUnspeccedSearchStarterPacksSkeleton.HandlerInput,
      AppBskyUnspeccedSearchStarterPacksSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.unspecced.searchStarterPacksSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
