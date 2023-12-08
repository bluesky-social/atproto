import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getLikes'
import AppContext from '../../../../context'
import { createPipelineNew } from '../../../../pipeline'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { parseString } from '../../../../hydration/util'
import { creatorFromUri } from '../../../../views/util'

export default function (server: Server, ctx: AppContext) {
  const getLikes = createPipelineNew(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getLikes({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.did
      const result = await getLikes({ ...params, viewer }, ctx)

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
  const likesRes = await ctx.hydrator.dataplane.getLikesBySubject({
    subjectUri: params.uri,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    likes: likesRes.uris,
    cursor: parseString(likesRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateLikes(skeleton.likes, params.viewer)
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.likes = skeleton.likes.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, params, skeleton, hydration } = inputs
  const likeViews = mapDefined(skeleton.likes, (uri) => {
    const like = hydration.likes?.get(uri)
    if (!like || !like.indexedAt || !like.record) {
      return
    }
    const creatorDid = creatorFromUri(uri)
    const actor = ctx.views.profile(creatorDid, hydration)
    if (!actor) {
      return
    }
    return {
      actor,
      createdAt: like.record.createdAt,
      indexedAt: like.indexedAt.toISOString(),
    }
  })
  return {
    likes: likeViews,
    cursor: skeleton.cursor,
    uri: params.uri,
    cid: params.cid,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  likes: string[]
  cursor?: string
}
