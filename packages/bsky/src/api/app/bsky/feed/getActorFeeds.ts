import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { app } from '../../../../lexicons/index.js'
import { createPipeline, noRules } from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getActorFeeds = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.feed.getActorFeeds, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getActorFeeds({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = inputs
  if (clearlyBadCursor(params.cursor)) {
    return { feedUris: [] }
  }
  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  const feedsRes = await ctx.dataplane.getActorFeeds({
    actorDid: did,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    feedUris: feedsRes.uris as AtUriString[],
    cursor: parseString(feedsRes.cursor),
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
    cursor: skeleton.cursor,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = app.bsky.feed.getActorFeeds.Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  feedUris: AtUriString[]
  cursor?: string
}
