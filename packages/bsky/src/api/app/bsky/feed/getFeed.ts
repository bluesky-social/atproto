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
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AlgoResponse, AlgoResponseItem } from '../../../../feed-gen/types'
import { createPipeline } from '../../../../pipeline'
import { HydrationState } from '../../../../hydration/hydrator'
import { mapDefined } from '@atproto/common'

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
      const viewer = auth.credentials.did

      const { timerSkele, timerHydr, ...result } = await getFeed(
        { ...params, viewer, authorization: req.headers['authorization'] },
        ctx,
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

const skeleton = async (params: Params, ctx: Context): Promise<Skeleton> => {
  const timerSkele = new ServerTimer('skele').start()
  const localAlgo = ctx.algos[params.feed]
  const { feedItems, cursor, ...passthrough } =
    localAlgo !== undefined
      ? await localAlgo(ctx, params, params.viewer)
      : await skeletonFromFeedGen(ctx, params)
  return {
    params,
    cursor,
    feedItems,
    timerSkele: timerSkele.stop(),
    passthrough,
  }
}

const hydration = async (state: Skeleton, ctx: Context) => {
  const timerHydr = new ServerTimer('hydr').start()
  const feedItemUris = state.feedItems.map((item) => item.itemUri)
  const hydration = await ctx.hydrator.hydrateFeedPosts(
    feedItemUris,
    state.params.viewer,
  )
  return { ...state, hydration, timerHydr: timerHydr.stop() }
}

const noBlocksOrMutes = (state: Hydration, ctx: Context) => {
  state.feedItems = state.feedItems.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item.itemUri, state.hydration)
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted
    )
  })
  return state
}

const presentation = (state: Hydration, ctx: Context) => {
  const feed = mapDefined(state.feedItems, (item) => {
    const view = ctx.views.feedViewPost(item.itemUri, state.hydration)
    if (view?.post.uri !== item.postUri) {
      return undefined
    } else {
      return view
    }
  }).slice(0, state.params.limit)
  return {
    feed,
    cursor: state.cursor,
    timerSkele: state.timerSkele,
    timerHydr: state.timerHydr,
    ...state.passthrough,
  }
}

type Context = AppContext

type Params = GetFeedParams & { viewer: string | null; authorization?: string }

type Skeleton = {
  params: Params
  feedItems: AlgoResponseItem[]
  passthrough: Record<string, unknown> // pass through additional items in feedgen response
  cursor?: string
  timerSkele: ServerTimer
}

type Hydration = Skeleton & {
  hydration: HydrationState
  timerHydr: ServerTimer
}

const skeletonFromFeedGen = async (
  ctx: Context,
  params: Params,
): Promise<AlgoResponse> => {
  const { feed } = params
  const found = await ctx.hydrator.feed.getFeedGens([feed], true)
  const feedDid = await found.get(feed)?.record.did
  if (!feedDid) {
    throw new InvalidRequestError('could not find feed')
  }

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
    const headers: Record<string, string> = params.authorization
      ? { authorization: params.authorization }
      : {}
    const result = await agent.api.app.bsky.feed.getFeedSkeleton(
      {
        feed: params.feed,
        limit: params.limit,
        cursor: params.cursor,
      },
      {
        headers,
      },
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

  const { feed: feedSkele, ...skele } = skeleton
  const feedItems = feedSkele.map((item) => ({
    itemUri:
      typeof item.reason?.repost === 'string' ? item.reason.repost : item.post,
    postUri: item.post,
  }))

  return { ...skele, feedItems }
}
