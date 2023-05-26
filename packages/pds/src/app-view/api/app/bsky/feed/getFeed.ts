import {
  InvalidRequestError,
  UpstreamFailureError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { getFeedGen } from '@atproto/identity'
import { AtpAgent, AppBskyFeedGetFeedSkeleton } from '@atproto/api'
import { SkeletonFeedPost } from '../../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams as GetFeedParams } from '../../../../../lexicon/types/app/bsky/feed/getFeed'
import { OutputSchema as SkeletonOutput } from '../../../../../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { AlgoResponse } from '../../../../../feed-gen/types'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const requester = auth.credentials.did

      const localAlgo = ctx.algos[feed]

      const { feedItems, ...rest } =
        localAlgo !== undefined
          ? await localAlgo(ctx, params, requester)
          : await skeletonFromFeedGen(ctx, params, requester)

      const feedService = ctx.services.appView.feed(ctx.db)
      const hydrated = await feedService.hydrateFeed(feedItems, requester)

      return {
        encoding: 'application/json',
        body: {
          ...rest,
          feed: hydrated,
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
  const resolved = await ctx.idResolver.did.resolve(feedDid)
  if (!resolved) {
    throw new InvalidRequestError(`could not resolve did document: ${feedDid}`)
  }
  const fgEndpoint = await getFeedGen(resolved)
  if (!fgEndpoint) {
    throw new InvalidRequestError(`not a valid feed generator: ${feedDid}`)
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
    if (err instanceof XRPCError && err.status === ResponseType.Unknown) {
      throw new UpstreamFailureError('Feed unavailable')
    }
    throw err
  }

  const { feed: skeletonFeed, ...rest } = skeleton

  // Hydrate feed skeleton
  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)
  const accountService = ctx.services.account(ctx.db)
  const feedItemUris = skeletonFeed.map(getSkeleFeedItemUri)

  const feedItems = feedItemUris.length
    ? await feedService
        .selectFeedItemQb()
        .where('feed_item.uri', 'in', feedItemUris)
        .whereNotExists(
          // Hide posts and reposts of or by muted actors
          accountService.mutedQb(requester, [
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

  const orderedItems = getOrderedFeedItems(skeletonFeed, feedItems)
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
) {
  const SKIP = []
  const feedItemsByUri = feedItems.reduce((acc, item) => {
    return Object.assign(acc, { [item.uri]: item })
  }, {} as Record<string, FeedRow>)
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
