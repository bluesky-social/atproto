import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { FeedItem } from '../../../../hydration/feed.js'
import type { HydrateCtx } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type RulesFnInput,
  type SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import { resHeaders } from '../../../util.js'
import {
  type AlgoResponseItem,
  feedItemFromSkeleton,
  filterBlocksAndMutesOnFeed,
  presentFeedItems,
} from './utils.js'

export default function (server: Server, ctx: AppContext) {
  const hydrateFeedSkeleton = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.feed.hydrateFeedSkeleton, {
    auth: ctx.authVerifier.standardReadOptional(),
    handler: async ({ input, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        xrpcEndpoint: app.bsky.feed.hydrateFeedSkeleton.$lxm,
        labelers,
        viewer,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({ viewer, req }),
        ),
      })

      const result = await hydrateFeedSkeleton(
        { ...input.body, hydrateCtx },
        ctx,
      )

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { params } = inputs
  return { items: params.feed.map(feedItemFromSkeleton), reqId: params.reqId }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateFeedItems(skeleton.items, params.hydrateCtx, {
    knownLikers:
      !!params.hydrateCtx.viewer &&
      params.hydrateCtx.features.checkGate(
        params.hydrateCtx.features.Gate.KnownLikersFeedEnable,
      ),
  })
}

const noBlocksOrMutes = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.items = filterBlocksAndMutesOnFeed(ctx, skeleton.items, hydration)
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  return {
    feed: presentFeedItems(ctx, skeleton.items, hydration, skeleton.reqId),
  }
}

type Context = AppContext

type Params = app.bsky.feed.hydrateFeedSkeleton.$InputBody & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  items: (AlgoResponseItem & FeedItem)[]
  reqId?: string
}
