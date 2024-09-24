import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getQuotes'
import { uriToDid } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getQuotes = ctx.createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getQuotes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getQuotes(hydrateCtx, params)
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
    uris: quotesRes.uris,
    cursor: parseString(quotesRes.cursor),
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, skeleton } = inputs
  return await ctx.hydrator.hydratePosts(
    skeleton.uris.map((uri) => ({ uri })),
    ctx.hydrateCtx,
  )
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.uris = skeleton.uris.filter((uri) => {
    const embedBlock = hydration.postBlocks?.get(uri)?.embed
    const authorDid = uriToDid(uri)
    return !ctx.views.viewerBlockExists(authorDid, hydration) && !embedBlock
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
  hydrateCtx: HydrateCtx
}

type Params = QueryParams

type Skeleton = {
  uris: string[]
  cursor?: string
}
