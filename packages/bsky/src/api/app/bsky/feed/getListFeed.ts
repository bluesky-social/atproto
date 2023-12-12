import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getListFeed'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { createPipelineNew } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { mapDefined } from '@atproto/common'
import { parseString } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  const getListFeed = createPipelineNew(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getListFeed({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.did

      const [result, repoRev] = await Promise.all([
        getListFeed({ ...params, viewer }, ctx),
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
  const res = await ctx.dataplane.getListFeed({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    uris: res.uris,
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

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  uris: string[]
  cursor?: string
}
