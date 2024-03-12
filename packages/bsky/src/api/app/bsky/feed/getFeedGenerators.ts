import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getFeedGenerators'
import AppContext from '../../../../context'
import { createPipeline, noRules } from '../../../../pipeline'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = createPipeline(
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
      const hydrateCtx = { labelers, viewer }
      const view = await getFeedGenerators({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: view,
        headers: resHeaders({ labelers }),
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
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateFeedGens(
    skeleton.feedUris,
    params.hydrateCtx,
  )
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
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  feedUris: string[]
}
