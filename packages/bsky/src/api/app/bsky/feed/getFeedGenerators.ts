import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getFeedGenerators.js'
import { noRules } from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const view = await getFeedGenerators(hydrateCtx, params)
      return {
        encoding: 'application/json',
        body: view,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: { params: Params }): Promise<Skeleton> => {
  return {
    feedUris: inputs.params.feeds,
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, skeleton } = inputs
  return await ctx.hydrator.hydrateFeedGens(skeleton.feedUris, ctx.hydrateCtx)
}

const presentation = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  const feeds = mapDefined(skeleton.feedUris, (uri) =>
    ctx.views.feedGenerator(uri, hydration),
  )
  return {
    feeds,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  feedUris: string[]
}
