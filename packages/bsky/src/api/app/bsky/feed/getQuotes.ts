import { mapDefined } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
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
import { uriToDid } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getQuotes = createPipeline(
    skeleton,
    hydration,
    noBlocksOrNeedsReview,
    presentation,
  )
  server.add(app.bsky.feed.getQuotes, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getQuotes({ ...params, hydrateCtx }, ctx)
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
    return { uris: [] }
  }
  const quotesRes = await ctx.hydrator.dataplane.getQuotesBySubjectSorted({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    uris: quotesRes.uris as AtUriString[],
    cursor: parseString(quotesRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}): Promise<HydrationState> => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydratePosts(
    skeleton.uris.map((uri) => ({ uri })),
    params.hydrateCtx,
  )
}

const noBlocksOrNeedsReview = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.uris = skeleton.uris.filter((uri) => {
    const authorDid = uriToDid(uri)
    return (
      !ctx.views.viewerBlockExists(authorDid, hydration) &&
      !hydration.postBlocks?.get(uri)?.embed &&
      ctx.views.viewerSeesNeedsReview({ did: authorDid, uri }, hydration)
    )
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
  const postViews = mapDefined(skeleton.uris, (uri) => {
    return ctx.views.post(uri, hydration)
  })
  return {
    posts: postViews,
    cursor: skeleton.cursor,
    uri: params.uri,
    cid: params.cid,
  }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.feed.getQuotes.Params & { hydrateCtx: HydrateCtx }

type Skeleton = {
  uris: AtUriString[]
  cursor?: string
}
