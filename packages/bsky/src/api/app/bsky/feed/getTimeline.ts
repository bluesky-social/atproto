import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import { setRepoRev } from '../../../util'
import { createPipeline } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { mapDefined } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  const getTimeline = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.did

      const [result, repoRev] = await Promise.all([
        getTimeline({ ...params, viewer }, ctx),
        ctx.hydrator.actor.getRepoRevSafe(viewer),
      ])

      setRepoRev(res, repoRev)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

export const skeleton = async (inputs: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const res = await ctx.dataplane.getTimeline({
    actorDid: params.viewer,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    uris: res.items.map((item) => item.repost || item.uri),
    cursor: parseString(res.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}): Promise<HydrationState> => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateFeedPosts(skeleton.uris, params.viewer)
}

const noBlocksOrMutes = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}): Skeleton => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.uris = skeleton.uris.filter((uri) => {
    const bam = ctx.views.feedItemBlocksAndMutes(uri, hydration)
    return (
      !bam.authorBlocked &&
      !bam.authorMuted &&
      !bam.originatorBlocked &&
      !bam.originatorMuted
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
  const feed = mapDefined(skeleton.uris, (uri) =>
    ctx.views.feedViewPost(uri, hydration),
  )
  return { feed, cursor: skeleton.cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = QueryParams & { viewer: string }

type Skeleton = {
  uris: string[]
  cursor?: string
}
