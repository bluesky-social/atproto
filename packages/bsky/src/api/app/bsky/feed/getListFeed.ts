import { mapDefined } from '@atproto/common'
import type { AtUriString, DidString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { DataPlaneClient } from '../../../../data-plane/index.js'
import type { FeedItem } from '../../../../hydration/feed.js'
import {
  type HydrateCtx,
  type HydrationState,
  type Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import { createPipeline } from '../../../../pipeline.js'
import { uriToDid } from '../../../../util/uris.js'
import type { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getListFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.add(app.bsky.feed.getListFeed, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })

      const result = await getListFeed({ ...params, hydrateCtx }, ctx)

      const repoRev = await ctx.hydrator.actor.getRepoRevSafe(viewer)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers, repoRev }),
      }
    },
  })
}

export const skeleton = async (inputs: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = inputs
  if (clearlyBadCursor(params.cursor)) {
    return { items: [] }
  }
  const res = await ctx.dataplane.getListFeed({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    items: res.items.map((item) => ({
      post: { uri: item.uri as AtUriString, cid: item.cid || undefined },
      repost: item.repost
        ? { uri: item.repost as AtUriString, cid: item.repostCid || undefined }
        : undefined,
    })),
    cursor: parseString(res.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}): Promise<HydrationState> => {
  const { ctx, params, skeleton } = inputs
  const [feedItemsState, bidirectionalBlocks] = await Promise.all([
    ctx.hydrator.hydrateFeedItems(skeleton.items, params.hydrateCtx),
    getBlocks({ ctx, params, skeleton }),
  ])
  return mergeStates(feedItemsState, {
    bidirectionalBlocks,
  })
}

const noBlocksOrMutes = (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}): Skeleton => {
  const { ctx, params, skeleton, hydration } = inputs
  skeleton.items = skeleton.items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    const creatorBlocks = hydration.bidirectionalBlocks?.get(
      uriToDid(params.list),
    )
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
      !bam.ancestorAuthorBlocked &&
      !creatorBlocks?.get(uriToDid(item.post.uri))
    )
  })
  return skeleton
}

const presentation = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  const feed = mapDefined(skeleton.items, (item) =>
    ctx.views.feedViewPost(item, hydration),
  )
  return { feed, cursor: skeleton.cursor }
}

const getBlocks = async (input: {
  ctx: Context
  skeleton: Skeleton
  params: Params
}) => {
  const { ctx, skeleton, params } = input
  const pairs: Map<DidString, DidString[]> = new Map()
  pairs.set(
    uriToDid(params.list),
    skeleton.items.map((item) => uriToDid(item.post.uri)),
  )
  return await ctx.hydrator.hydrateBidirectionalBlocks(pairs, params.hydrateCtx)
}

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = app.bsky.feed.getListFeed.$Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}
