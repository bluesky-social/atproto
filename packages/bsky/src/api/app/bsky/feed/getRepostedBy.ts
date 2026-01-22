import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { app } from '../../../../lexicons/index.js'
import { createPipeline } from '../../../../pipeline'
import { uriToDid as creatorFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getRepostedBy = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.feed.getRepostedBy, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getRepostedBy({ ...params, hydrateCtx }, ctx)

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
    return { reposts: [] }
  }
  const res = await ctx.hydrator.dataplane.getRepostsBySubject({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    reposts: res.uris as AtUriString[],
    cursor: parseString(res.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydrateReposts(skeleton.reposts, params.hydrateCtx)
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.reposts = skeleton.reposts.filter((uri) => {
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
  const repostViews = mapDefined(skeleton.reposts, (uri) => {
    const repost = hydration.reposts?.get(uri)
    if (!repost?.record) {
      return
    }
    const creatorDid = creatorFromUri(uri)
    return ctx.views.profile(creatorDid, hydration)
  })
  return {
    repostedBy: repostViews,
    cursor: skeleton.cursor,
    uri: params.uri,
    cid: params.cid,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.feed.getRepostedBy.Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  reposts: AtUriString[]
  cursor?: string
}
