import {
  InvalidRequestError,
  UpstreamFailureError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { getFeedGen } from '@atproto/did-resolver'
import { AtpAgent } from '@atproto/api'
import { SkeletonFeedPost } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { QueryParams as GetFeedParams } from '@atproto/api/src/client/types/app/bsky/feed/getFeed'
import {
  OutputSchema as SkeletonOutput,
  UnknownFeedError,
} from '@atproto/api/src/client/types/app/bsky/feed/getFeedSkeleton'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import algos from './algos'
import { AlgoResponse } from './algos/types'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { feed } = params
      const requester = auth.credentials.did

      const localAlgo = algos[feed]

      const res =
        algos !== undefined
          ? await localAlgo(ctx, params, requester)
          : await skeletonFromFeedGen(ctx, params, requester)

      const feedService = ctx.services.appView.feed(ctx.db)
      const hydrated = await feedService.hydrateFeed(res.feedItems, requester)

      return {
        encoding: 'application/json',
        body: {
          cursor: res.cursor,
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
  const resolved = await ctx.didResolver.resolveDid(feedDid)
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
    if (err instanceof UnknownFeedError) {
      throw new InvalidRequestError(err.message, 'UnknownFeed')
    }
    if (err instanceof XRPCError && err.status === ResponseType.Unknown) {
      throw new UpstreamFailureError('Feed unavailable')
    }
    throw err
  }

  // Hydrate feed skeleton
  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)
  const accountService = ctx.services.account(ctx.db)
  const feedItemUris = skeleton.feed.map(getSkeleFeedItemUri)

  const feedItems = (await feedItemUris.length)
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

  const orderedItems = getOrderedFeedItems(skeleton.feed, feedItems)
  return {
    cursor: skeleton.cursor,
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
