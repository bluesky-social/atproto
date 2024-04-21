import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getListFeed'
import AppContext from '../../../../context'
import { clearlyBadCursor, resHeaders } from '../../../util'
import { createPipeline } from '../../../../pipeline'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { mapDefined } from '@atproto/common'
import { parseString } from '../../../../hydration/util'
import { FeedItem } from '../../../../hydration/feed'

export default function (server: Server, ctx: AppContext) {
  const getListFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getListFeed({
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
      post: { uri: item.uri, cid: item.cid || undefined },
      repost: item.repost
        ? { uri: item.repost, cid: item.repostCid || undefined }
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
  return ctx.hydrator.hydrateFeedItems(skeleton.items, params.hydrateCtx)
}

const noBlocksOrMutes = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}): Skeleton => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.items = skeleton.items.filter((item) => {
    const bam = ctx.views.feedItemBlocksAndMutes(item, hydration)
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted &&
      !bam.parentAuthorBlocked
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

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}
