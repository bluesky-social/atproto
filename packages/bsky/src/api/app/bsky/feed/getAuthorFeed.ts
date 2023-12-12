import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { createPipelineNew } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  const getAuthorFeed = createPipelineNew(
    skeleton,
    hydration,
    noBlocksOrMutedReposts,
    presentation,
  )
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ params, auth, res }) => {
      const viewer =
        auth.credentials.type === 'access' ? auth.credentials.did : null

      const [result, repoRev] = await Promise.all([
        getAuthorFeed({ ...params, viewer }, ctx),
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
  const [did] = await ctx.hydrator.actor.getDids([params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  const actor = await ctx.hydrator.actor.getActors([did])
  if (!actor.get(did) || actor.get(did)?.takendown) {
    throw new InvalidRequestError('Profile not found')
  }
  const res = await ctx.dataplane.getAuthorFeed({
    actorDid: did,
    limit: params.limit,
    cursor: params.cursor,
    noReplies: params.filter === 'posts_no_replies',
    mediaOnly: params.filter === 'posts_with_media',
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

const noBlocksOrMutedReposts = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}): Skeleton => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.uris = skeleton.uris.filter((uri) => {
    const bam = ctx.views.feedItemBlocksAndMutes(uri, hydration)
    return (
      !bam.authorBlocked &&
      !bam.originatorBlocked &&
      !(bam.authorMuted && !bam.originatorMuted)
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
