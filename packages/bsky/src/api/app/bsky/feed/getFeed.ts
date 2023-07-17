import {
  InvalidRequestError,
  UpstreamFailureError,
  ServerTimer,
  serverTimingHeader,
} from '@atproto/xrpc-server'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import {
  DidDocument,
  PoorlyFormattedDidDocumentError,
  getFeedGen,
} from '@atproto/identity'
import { AtpAgent, AppBskyFeedGetFeedSkeleton } from '@atproto/api'
import { SkeletonFeedPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { QueryParams as GetFeedParams } from '../../../../lexicon/types/app/bsky/feed/getFeed'
import { OutputSchema as SkeletonOutput } from '../../../../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedRow } from '../../../../services/feed/types'
import { AlgoResponse } from '../../../../feed-gen/types'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeed({
    auth: ctx.authVerifierAnyAudience,
    handler: async ({ params, auth, req }) => {
      const { feed } = params
      const viewer = auth.credentials.did
      const feedService = ctx.services.feed(ctx.db)
      const localAlgo = ctx.algos[feed]

      const timerSkele = new ServerTimer('skele').start()
      const { feedItems, ...rest } =
        localAlgo !== undefined
          ? await localAlgo(ctx, params, viewer)
          : await skeletonFromFeedGen(
              ctx,
              params,
              viewer,
              req.headers['authorization'],
            )
      timerSkele.stop()

      const timerHydr = new ServerTimer('hydr').start()
      const hydrated = await feedService.hydrateFeed(feedItems, viewer)
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
  viewer: string,
  authorization?: string,
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

  let resolved: DidDocument | null
  try {
    resolved = await ctx.idResolver.did.resolve(feedDid)
  } catch (err) {
    if (err instanceof PoorlyFormattedDidDocumentError) {
      throw new InvalidRequestError(`invalid did document: ${feedDid}`)
    }
    throw err
  }
  if (!resolved) {
    throw new InvalidRequestError(`could not resolve did document: ${feedDid}`)
  }

  const fgEndpoint = getFeedGen(resolved)
  if (!fgEndpoint) {
    throw new InvalidRequestError(
      `invalid feed generator service details in did document: ${feedDid}`,
    )
  }

  const agent = new AtpAgent({ service: fgEndpoint })

  let skeleton: SkeletonOutput
  try {
    // @TODO currently passthrough auth headers from pds
    const headers: Record<string, string> = authorization
      ? { authorization }
      : {}
    const result = await agent.api.app.bsky.feed.getFeedSkeleton(params, {
      headers,
    })
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

  const { feed: skeletonFeed, ...rest } = skeleton

  // Hydrate feed skeleton
  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.feed(ctx.db)
  const graphService = ctx.services.graph(ctx.db)
  const feedItemUris = skeletonFeed.map(getSkeleFeedItemUri)

  // @TODO apply mutes and blocks
  const feedItems = feedItemUris.length
    ? await feedService
        .selectFeedItemQb()
        .where('feed_item.uri', 'in', feedItemUris)
        .where((qb) =>
          // Hide posts and reposts of or by muted actors
          graphService.whereNotMuted(qb, viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .whereNotExists(
          graphService.blockQb(viewer, [
            ref('post.creator'),
            ref('originatorDid'),
          ]),
        )
        .execute()
    : []

  const orderedItems = getOrderedFeedItems(skeletonFeed, feedItems, params)
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
  params: GetFeedParams,
) {
  const SKIP = []
  const feedItemsByUri = feedItems.reduce((acc, item) => {
    return Object.assign(acc, { [item.uri]: item })
  }, {} as Record<string, FeedRow>)
  // enforce limit param in the case that the feedgen does not
  if (skeletonItems.length > params.limit) {
    skeletonItems = skeletonItems.slice(0, params.limit)
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
