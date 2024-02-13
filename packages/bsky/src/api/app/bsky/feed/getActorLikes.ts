import { InvalidRequestError } from '@atproto/xrpc-server'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getActorLikes'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { createPipeline } from '../../../../pipeline'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { creatorFromUri } from '../../../../views/util'

export default function (server: Server, ctx: AppContext) {
  const getActorLikes = createPipeline(
    skeleton,
    hydration,
    noPostBlocks,
    presentation,
  )
  server.app.bsky.feed.getActorLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req, res }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = { labelers, viewer }

      const [result, repoRev] = await Promise.all([
        getActorLikes({ ...params, hydrateCtx }, ctx),
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

const skeleton = async (inputs: {
  ctx: Context
  params: Params
}): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const { actor, limit, cursor } = params
  const viewer = params.hydrateCtx.viewer

  const [actorDid] = await ctx.hydrator.actor.getDids([actor])
  if (!actorDid || !viewer || viewer !== actorDid) {
    throw new InvalidRequestError('Profile not found')
  }

  const likesRes = await ctx.dataplane.getActorLikes({
    actorDid,
    limit,
    cursor,
  })

  const postUris = likesRes.likes.map((l) => l.subject)

  return {
    postUris,
    cursor: parseString(likesRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateFeedPosts(
    skeleton.postUris,
    params.hydrateCtx,
  )
}

const noPostBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.postUris = skeleton.postUris.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  const feed = mapDefined(skeleton.postUris, (uri) =>
    ctx.views.feedViewPost(uri, hydration),
  )
  return {
    feed,
    cursor: skeleton.cursor,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  postUris: string[]
  cursor?: string
}
