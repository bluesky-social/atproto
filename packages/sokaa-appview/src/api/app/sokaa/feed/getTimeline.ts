import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane/client'
import { FeedItem } from '../../../../hydration/feed'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/sokaa/feed/getTimeline'
import { createPipeline, noRules } from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getTimeline = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.sokaa.feed.getTimeline({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const hydrateCtx = ctx.hydrator.createContext({ viewer })

      const result = await getTimeline(
        { ...params, hydrateCtx: { ...hydrateCtx, viewer } },
        ctx,
      )

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders(),
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
  const res = await ctx.dataplane.getTimeline({
    actorDid: params.hydrateCtx.viewer!,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    items: res.items.map((item) => ({
      post: { uri: item.uri, cid: item.cid || undefined },
    })),
    cursor: parseString(res.cursor),
  }
}

export const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}): Promise<HydrationState> => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateFeedItems(skeleton.items, params.hydrateCtx)
}

export const presentation = (inputs: {
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

type Params = QueryParams & { hydrateCtx: HydrateCtx & { viewer: string } }

type Skeleton = {
  items: FeedItem[]
  cursor?: string
}
