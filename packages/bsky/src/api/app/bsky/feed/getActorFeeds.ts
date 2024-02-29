import { InvalidRequestError } from '@atproto/xrpc-server'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getActorFeeds'
import AppContext from '../../../../context'
import { createPipeline, noRules } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { clearlyBadCursor } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getActorFeeds = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.feed.getActorFeeds({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.iss
      const result = await getActorFeeds({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: result,
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
    feedUris: feedsRes.uris,
    cursor: parseString(feedsRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateFeedGens(skeleton.feedUris, params.viewer)
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

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  feedUris: string[]
  cursor?: string
}
