import { mapDefined } from '@atproto/common'
import { normalizeDatetimeAlways } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getLikes'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getLikes = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getLikes(hydrateCtx, params)

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
    return { likes: [] }
  }
  if (looksLikeNonSortedCursor(params.cursor)) {
    throw new InvalidRequestError(
      'Cursor appear to be out of date, please try reloading.',
    )
  }
  const likesRes = await ctx.hydrator.dataplane.getLikesBySubjectSorted({
    subject: { uri: params.uri, cid: params.cid },
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
  const { ctx, skeleton } = inputs
  return await ctx.hydrator.hydrateLikes(skeleton.likes, ctx.hydrateCtx)
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
    if (!like || !like.record) {
      return
    }
    const creatorDid = creatorFromUri(uri)
    const actor = ctx.views.profile(creatorDid, hydration)
    if (!actor) {
      return
    }
    return {
      actor,
      createdAt: normalizeDatetimeAlways(like.record.createdAt),
      indexedAt: like.sortedAt.toISOString(),
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
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  likes: string[]
  cursor?: string
}

const looksLikeNonSortedCursor = (cursor: string | undefined) => {
  // the old cursor values used with getLikesBySubject() were dids.
  // we now use getLikesBySubjectSorted(), whose cursors look like timestamps.
  return cursor?.startsWith('did:')
}
