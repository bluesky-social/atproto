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
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'

export class AppBskyUnspeccedNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  getAgeAssuranceState(
    params?: AppBskyUnspeccedGetAgeAssuranceState.QueryParams,
    opts?: AppBskyUnspeccedGetAgeAssuranceState.CallOptions,
  ): Promise<AppBskyUnspeccedGetAgeAssuranceState.Response> {
    return this._client.call(
      'app.bsky.unspecced.getAgeAssuranceState',
      params,
      undefined,
      opts,
    )
  }

  getConfig(
    params?: AppBskyUnspeccedGetConfig.QueryParams,
    opts?: AppBskyUnspeccedGetConfig.CallOptions,
  ): Promise<AppBskyUnspeccedGetConfig.Response> {
    return this._client.call(
      'app.bsky.unspecced.getConfig',
      params,
      undefined,
      opts,
    )
  }

  getPopularFeedGenerators(
    params?: AppBskyUnspeccedGetPopularFeedGenerators.QueryParams,
    opts?: AppBskyUnspeccedGetPopularFeedGenerators.CallOptions,
  ): Promise<AppBskyUnspeccedGetPopularFeedGenerators.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPopularFeedGenerators',
      params,
      undefined,
      opts,
    )
  }

  getPostThreadOtherV2(
    params?: AppBskyUnspeccedGetPostThreadOtherV2.QueryParams,
    opts?: AppBskyUnspeccedGetPostThreadOtherV2.CallOptions,
  ): Promise<AppBskyUnspeccedGetPostThreadOtherV2.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPostThreadOtherV2',
      params,
      undefined,
      opts,
    )
  }

  getPostThreadV2(
    params?: AppBskyUnspeccedGetPostThreadV2.QueryParams,
    opts?: AppBskyUnspeccedGetPostThreadV2.CallOptions,
  ): Promise<AppBskyUnspeccedGetPostThreadV2.Response> {
    return this._client.call(
      'app.bsky.unspecced.getPostThreadV2',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFeeds(
    params?: AppBskyUnspeccedGetSuggestedFeeds.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedFeeds.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedFeeds.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedFeeds',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedFeedsSkeleton(
    params?: AppBskyUnspeccedGetSuggestedFeedsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedFeedsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedFeedsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedFeedsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedStarterPacks(
    params?: AppBskyUnspeccedGetSuggestedStarterPacks.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedStarterPacks.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedStarterPacks.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedStarterPacks',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedStarterPacksSkeleton(
    params?: AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedStarterPacksSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedStarterPacksSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedUsers(
    params?: AppBskyUnspeccedGetSuggestedUsers.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedUsers.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedUsers.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedUsers',
      params,
      undefined,
      opts,
    )
  }

  getSuggestedUsersSkeleton(
    params?: AppBskyUnspeccedGetSuggestedUsersSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestedUsersSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestedUsersSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestedUsersSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getSuggestionsSkeleton(
    params?: AppBskyUnspeccedGetSuggestionsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetSuggestionsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetSuggestionsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getSuggestionsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  getTaggedSuggestions(
    params?: AppBskyUnspeccedGetTaggedSuggestions.QueryParams,
    opts?: AppBskyUnspeccedGetTaggedSuggestions.CallOptions,
  ): Promise<AppBskyUnspeccedGetTaggedSuggestions.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTaggedSuggestions',
      params,
      undefined,
      opts,
    )
  }

  getTrendingTopics(
    params?: AppBskyUnspeccedGetTrendingTopics.QueryParams,
    opts?: AppBskyUnspeccedGetTrendingTopics.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrendingTopics.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrendingTopics',
      params,
      undefined,
      opts,
    )
  }

  getTrends(
    params?: AppBskyUnspeccedGetTrends.QueryParams,
    opts?: AppBskyUnspeccedGetTrends.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrends.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrends',
      params,
      undefined,
      opts,
    )
  }

  getTrendsSkeleton(
    params?: AppBskyUnspeccedGetTrendsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedGetTrendsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedGetTrendsSkeleton.Response> {
    return this._client.call(
      'app.bsky.unspecced.getTrendsSkeleton',
      params,
      undefined,
      opts,
    )
  }

  initAgeAssurance(
    data?: AppBskyUnspeccedInitAgeAssurance.InputSchema,
    opts?: AppBskyUnspeccedInitAgeAssurance.CallOptions,
  ): Promise<AppBskyUnspeccedInitAgeAssurance.Response> {
    return this._client
      .call('app.bsky.unspecced.initAgeAssurance', opts?.qp, data, opts)
      .catch((e) => {
        throw AppBskyUnspeccedInitAgeAssurance.toKnownErr(e)
      })
  }

  searchActorsSkeleton(
    params?: AppBskyUnspeccedSearchActorsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchActorsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchActorsSkeleton.Response> {
    return this._client
      .call('app.bsky.unspecced.searchActorsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchActorsSkeleton.toKnownErr(e)
      })
  }

  searchPostsSkeleton(
    params?: AppBskyUnspeccedSearchPostsSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchPostsSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchPostsSkeleton.Response> {
    return this._client
      .call('app.bsky.unspecced.searchPostsSkeleton', params, undefined, opts)
      .catch((e) => {
        throw AppBskyUnspeccedSearchPostsSkeleton.toKnownErr(e)
      })
  }

  searchStarterPacksSkeleton(
    params?: AppBskyUnspeccedSearchStarterPacksSkeleton.QueryParams,
    opts?: AppBskyUnspeccedSearchStarterPacksSkeleton.CallOptions,
  ): Promise<AppBskyUnspeccedSearchStarterPacksSkeleton.Response> {
    return this._client
      .call(
        'app.bsky.unspecced.searchStarterPacksSkeleton',
        params,
        undefined,
        opts,
      )
      .catch((e) => {
        throw AppBskyUnspeccedSearchStarterPacksSkeleton.toKnownErr(e)
      })
  }
}
