import {
  InvalidRequestError,
  UpstreamFailureError,
  createServiceAuthHeaders,
  ServerTimer,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { getFeedGen } from '@atproto/identity'
import { AtpAgent, AppBskyFeedGetFeedSkeleton } from '@atproto/api'
import { SkeletonFeedPost } from '../../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams as GetFeedParams } from '../../../../../lexicon/types/app/bsky/feed/getFeed'
import { OutputSchema as SkeletonOutput } from '../../../../../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { AlgoResponse } from '../../../../../feed-gen/types'
import { getDidDoc } from '../util/resolver'

export default function (server: Server, ctx: AppContext) {
  const isProxyableFeed = (feed: string): boolean => {
    return feed in ctx.algos
  }

  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did

      if (await ctx.canProxyRead(req, requester)) {
        const { data: feed } =
          await ctx.appviewAgent.api.app.bsky.feed.getFeedGenerator(
            { feed: params.feed },
            await ctx.serviceAuthHeaders(requester),
          )
        const res = await ctx.appviewAgent.api.app.bsky.feed.getFeed(
          params,
          await ctx.serviceAuthHeaders(requester, feed.view.did),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }
      let algoRes: AlgoResponse
      const timerSkele = new ServerTimer('skele').start()

      if (ctx.cfg.bskyAppViewEndpoint && isProxyableFeed(params.feed)) {
        // this is a temporary solution to smart proxy bsky feeds to the appview
        const res = await ctx.appviewAgent.api.app.bsky.feed.getFeedSkeleton(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        algoRes = await filterMutesAndBlocks(
          ctx,
          res.data,
          params.limit,
          requester,
        )
      } else {
        algoRes = await skeletonFromFeedGen(ctx, params, requester)
      }

      timerSkele.stop()

      const feedService = ctx.services.appView.feed(ctx.db)
      const { feedItems, ...rest } = algoRes

      const timerHydr = new ServerTimer('hydr').start()
      const hydrated = await feedService.hydrateFeed(feedItems, requester)
      timerHydr.stop()

      return {
        encoding: 'application/json',
        body: {
          ...rest,
          feed: hydrated,
        },
        headers: {
          'server-timing': serverTimingHeader([timerSkele, timerHydr]),
        },
      }
    },
  })
}

async function skeletonFromFeedGen(
  ctx: AppContext,
  params: GetFeedParams,
  requester: string,
): Promise<AlgoResponse> {
  const { feed } = params
  // Resolve and fetch feed skeleton
  const found = await ctx.db.db
    .selectFrom('feed_generator')
    .where('uri', '=', feed)
    .select('feedDid')
    .executeTakeFirst()
  if (!found) {
    throw new InvalidRequestError('could not find feed')
  }
  const feedDid = found.feedDid

  const doc = await getDidDoc(ctx, feedDid)
  const fgEndpoint = getFeedGen(doc)
  if (!fgEndpoint) {
    throw new InvalidRequestError(
      `invalid feed generator service details in did document: ${feedDid}`,
    )
  }

  const agent = new AtpAgent({ service: fgEndpoint })
  const headers = await createServiceAuthHeaders({
    iss: requester,
    aud: feedDid,
    keypair: ctx.repoSigningKey,
  })

  let skeleton: SkeletonOutput
  try {
    const result = await agent.api.app.bsky.feed.getFeedSkeleton(
      params,
      headers,
    )
    skeleton = result.data
  } catch (err) {
    if (err instanceof AppBskyFeedGetFeedSkeleton.UnknownFeedError) {
      throw new InvalidRequestError(err.message, 'UnknownFeed')
    }
    if (err instanceof XRPCError) {
      if (err.status === ResponseType.Unknown) {
        throw new UpstreamFailureError('feed unavailable')
      }
      if (err.status === ResponseType.InvalidResponse) {
        throw new UpstreamFailureError(
          'feed provided an invalid response',
          'InvalidFeedResponse',
        )
      }
    }
    throw err
  }

  return filterMutesAndBlocks(ctx, skeleton, params.limit, requester)
}

export async function filterMutesAndBlocks(
  ctx: AppContext,
  skeleton: SkeletonOutput,
  limit: number,
  requester: string,
) {
  const { feed: skeletonFeed, ...rest } = skeleton

  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)
  const accountService = ctx.services.account(ctx.db)
  const feedItemUris = skeletonFeed.map(getSkeleFeedItemUri)

  const feedItems = feedItemUris.length
    ? await feedService
        .selectFeedItemQb()
        .where('feed_item.uri', 'in', feedItemUris)
        .where((qb) =>
          // Hide posts and reposts of or by muted actors
          accountService.whereNotMuted(qb, requester, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .whereNotExists(
          graphService.blockQb(requester, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .execute()
    : []

  const orderedItems = getOrderedFeedItems(skeletonFeed, feedItems, limit)
  return {
    ...rest,
    feedItems: orderedItems,
  }
}

function getSkeleFeedItemUri(item: SkeletonFeedPost) {
  if (typeof item.reason?.repost === 'string') {
    return item.reason.repost
  }
  return item.post
}

function getOrderedFeedItems(
  skeletonItems: SkeletonFeedPost[],
  feedItems: FeedRow[],
  limit: number,
) {
  const SKIP = []
  const feedItemsByUri = feedItems.reduce((acc, item) => {
    return Object.assign(acc, { [item.uri]: item })
  }, {} as Record<string, FeedRow>)
  // enforce limit param in the case that the feedgen does not
  if (skeletonItems.length > limit) {
    skeletonItems = skeletonItems.slice(0, limit)
  }
  return skeletonItems.flatMap((item) => {
    const uri = getSkeleFeedItemUri(item)
    const feedItem = feedItemsByUri[uri]
    if (!feedItem || item.post !== feedItem.postUri) {
      // Couldn't find the record, or skeleton repost referenced the wrong post
      return SKIP
    }
    return feedItem
  })
}
