import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
import { createPipeline, noRules } from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.feed.getFeedGenerators, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const view = await getFeedGenerators({ ...params, hydrateCtx }, ctx)
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

type Params = app.bsky.feed.getFeedGenerators.Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  feedUris: AtUriString[]
}
