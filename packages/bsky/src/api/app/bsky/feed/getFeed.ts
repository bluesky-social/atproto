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
import { QueryParams as GetFeedParams } from '../../../../lexicon/types/app/bsky/feed/getFeed'
import { OutputSchema as SkeletonOutput } from '../../../../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { SkeletonFeedPost } from '../../../../lexicon/types/app/bsky/feed/defs'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AlgoResponse } from '../../../../feed-gen/types'
import { Database } from '../../../../db'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getFeed({
    auth: ctx.authOptionalVerifierAnyAudience,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const viewer = auth.credentials.did

      const { timerSkele, timerHydr, ...result } = await getFeed(
        { ...params, viewer },
        {
          db,
          feedService,
          appCtx: ctx,
          authorization: req.headers['authorization'],
        },
      )

      return {
        encoding: 'application/json',
        body: result,
        headers: {
          'server-timing': serverTimingHeader([timerSkele, timerHydr]),
        },
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const timerSkele = new ServerTimer('skele').start()
  const localAlgo = ctx.appCtx.algos[params.feed]
  const feedParams: GetFeedParams = {
    feed: params.feed,
    limit: params.limit,
    cursor: params.cursor,
  }
  const { feedItems, cursor, ...passthrough } =
    localAlgo !== undefined
      ? await localAlgo(ctx.appCtx, params, params.viewer)
      : await skeletonFromFeedGen(ctx, feedParams)
  return {
    params,
    cursor,
    feedItems,
    timerSkele: timerSkele.stop(),
    passthrough,
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const timerHydr = new ServerTimer('hydr').start()
  const { feedService } = ctx
  const { params, feedItems } = state
  const refs = feedService.feedItemRefs(feedItems)
  const hydrated = await feedService.feedHydration({
    ...refs,
    viewer: params.viewer,
  })
  return { ...state, ...hydrated, timerHydr: timerHydr.stop() }
}

const noBlocksOrMutes = (state: HydrationState) => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter((item) => {
    if (!viewer) return true
    return (
      !state.bam.block([viewer, item.postAuthorDid]) &&
      !state.bam.block([viewer, item.originatorDid]) &&
      !state.bam.mute([viewer, item.postAuthorDid]) &&
      !state.bam.mute([viewer, item.originatorDid])
    )
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const { feedItems, cursor, passthrough, params } = state
  const feed = feedService.views.formatFeed(feedItems, state, params.viewer)
  return {
    feed,
    cursor,
    timerSkele: state.timerSkele,
    timerHydr: state.timerHydr,
    ...passthrough,
  }
}

type Context = {
  db: Database
  feedService: FeedService
  appCtx: AppContext
  authorization?: string
}

type Params = GetFeedParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  passthrough: Record<string, unknown> // pass through additional items in feedgen response
  cursor?: string
  timerSkele: ServerTimer
}

type HydrationState = SkeletonState &
  FeedHydrationState & { feedItems: FeedRow[]; timerHydr: ServerTimer }

const skeletonFromFeedGen = async (
  ctx: Context,
  params: GetFeedParams,
): Promise<AlgoResponse> => {
  const { db, appCtx, authorization } = ctx
  const { feed } = params
  // Resolve and fetch feed skeleton
  const found = await db.db
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
    resolved = await appCtx.idResolver.did.resolve(feedDid)
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
      ? { authorization: authorization }
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

  const { feed: feedSkele, ...skele } = skeleton
  const feedItems = await skeletonToFeedItems(
    feedSkele.slice(0, params.limit),
    ctx,
  )

  return { ...skele, feedItems }
}

const skeletonToFeedItems = async (
  skeleton: SkeletonFeedPost[],
  ctx: Context,
): Promise<FeedRow[]> => {
  const { feedService } = ctx
  const feedItemUris = skeleton.map(getSkeleFeedItemUri)
  const feedItemsRaw = await feedService.getFeedItems(feedItemUris)
  const results: FeedRow[] = []
  for (const skeleItem of skeleton) {
    const feedItem = feedItemsRaw[getSkeleFeedItemUri(skeleItem)]
    if (feedItem && feedItem.postUri === skeleItem.post) {
      results.push(feedItem)
    }
  }
  return results
}

const getSkeleFeedItemUri = (item: SkeletonFeedPost) => {
  return typeof item.reason?.repost === 'string'
    ? item.reason.repost
    : item.post
}
