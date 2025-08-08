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
import * as AppBskyFeedDescribeFeedGenerator from '../../../../types/app/bsky/feed/describeFeedGenerator.js'
import * as AppBskyFeedGenerator from '../../../../types/app/bsky/feed/generator.js'
import * as AppBskyFeedGetActorFeeds from '../../../../types/app/bsky/feed/getActorFeeds.js'
import * as AppBskyFeedGetActorLikes from '../../../../types/app/bsky/feed/getActorLikes.js'
import * as AppBskyFeedGetAuthorFeed from '../../../../types/app/bsky/feed/getAuthorFeed.js'
import * as AppBskyFeedGetFeed from '../../../../types/app/bsky/feed/getFeed.js'
import * as AppBskyFeedGetFeedGenerator from '../../../../types/app/bsky/feed/getFeedGenerator.js'
import * as AppBskyFeedGetFeedGenerators from '../../../../types/app/bsky/feed/getFeedGenerators.js'
import * as AppBskyFeedGetFeedSkeleton from '../../../../types/app/bsky/feed/getFeedSkeleton.js'
import * as AppBskyFeedGetLikes from '../../../../types/app/bsky/feed/getLikes.js'
import * as AppBskyFeedGetListFeed from '../../../../types/app/bsky/feed/getListFeed.js'
import * as AppBskyFeedGetPostThread from '../../../../types/app/bsky/feed/getPostThread.js'
import * as AppBskyFeedGetPosts from '../../../../types/app/bsky/feed/getPosts.js'
import * as AppBskyFeedGetQuotes from '../../../../types/app/bsky/feed/getQuotes.js'
import * as AppBskyFeedGetRepostedBy from '../../../../types/app/bsky/feed/getRepostedBy.js'
import * as AppBskyFeedGetSuggestedFeeds from '../../../../types/app/bsky/feed/getSuggestedFeeds.js'
import * as AppBskyFeedGetTimeline from '../../../../types/app/bsky/feed/getTimeline.js'
import * as AppBskyFeedLike from '../../../../types/app/bsky/feed/like.js'
import * as AppBskyFeedPost from '../../../../types/app/bsky/feed/post.js'
import * as AppBskyFeedPostgate from '../../../../types/app/bsky/feed/postgate.js'
import * as AppBskyFeedRepost from '../../../../types/app/bsky/feed/repost.js'
import * as AppBskyFeedSearchPosts from '../../../../types/app/bsky/feed/searchPosts.js'
import * as AppBskyFeedSendInteractions from '../../../../types/app/bsky/feed/sendInteractions.js'
import * as AppBskyFeedThreadgate from '../../../../types/app/bsky/feed/threadgate.js'
import { Server } from '../../../../index.js'

export class AppBskyFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  describeFeedGenerator<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedDescribeFeedGenerator.QueryParams,
      AppBskyFeedDescribeFeedGenerator.HandlerInput,
      AppBskyFeedDescribeFeedGenerator.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.describeFeedGenerator' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetActorFeeds.QueryParams,
      AppBskyFeedGetActorFeeds.HandlerInput,
      AppBskyFeedGetActorFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getActorFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorLikes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetActorLikes.QueryParams,
      AppBskyFeedGetActorLikes.HandlerInput,
      AppBskyFeedGetActorLikes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getActorLikes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getAuthorFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetAuthorFeed.QueryParams,
      AppBskyFeedGetAuthorFeed.HandlerInput,
      AppBskyFeedGetAuthorFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getAuthorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeed.QueryParams,
      AppBskyFeedGetFeed.HandlerInput,
      AppBskyFeedGetFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedGenerator<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedGenerator.QueryParams,
      AppBskyFeedGetFeedGenerator.HandlerInput,
      AppBskyFeedGetFeedGenerator.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedGenerator' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedGenerators<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedGenerators.QueryParams,
      AppBskyFeedGetFeedGenerators.HandlerInput,
      AppBskyFeedGetFeedGenerators.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedGenerators' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFeedSkeleton<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetFeedSkeleton.QueryParams,
      AppBskyFeedGetFeedSkeleton.HandlerInput,
      AppBskyFeedGetFeedSkeleton.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getFeedSkeleton' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLikes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetLikes.QueryParams,
      AppBskyFeedGetLikes.HandlerInput,
      AppBskyFeedGetLikes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getLikes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getListFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetListFeed.QueryParams,
      AppBskyFeedGetListFeed.HandlerInput,
      AppBskyFeedGetListFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getListFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPostThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetPostThread.QueryParams,
      AppBskyFeedGetPostThread.HandlerInput,
      AppBskyFeedGetPostThread.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getPostThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getPosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetPosts.QueryParams,
      AppBskyFeedGetPosts.HandlerInput,
      AppBskyFeedGetPosts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getPosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getQuotes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetQuotes.QueryParams,
      AppBskyFeedGetQuotes.HandlerInput,
      AppBskyFeedGetQuotes.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getQuotes' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepostedBy<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetRepostedBy.QueryParams,
      AppBskyFeedGetRepostedBy.HandlerInput,
      AppBskyFeedGetRepostedBy.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getRepostedBy' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getSuggestedFeeds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetSuggestedFeeds.QueryParams,
      AppBskyFeedGetSuggestedFeeds.HandlerInput,
      AppBskyFeedGetSuggestedFeeds.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getSuggestedFeeds' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTimeline<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedGetTimeline.QueryParams,
      AppBskyFeedGetTimeline.HandlerInput,
      AppBskyFeedGetTimeline.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchPosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedSearchPosts.QueryParams,
      AppBskyFeedSearchPosts.HandlerInput,
      AppBskyFeedSearchPosts.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.searchPosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  sendInteractions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyFeedSendInteractions.QueryParams,
      AppBskyFeedSendInteractions.HandlerInput,
      AppBskyFeedSendInteractions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.feed.sendInteractions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
