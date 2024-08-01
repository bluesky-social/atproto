import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { createPipeline } from '../../../../pipeline'
import { clearlyBadCursor, resHeaders } from '../../../util'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getQuotes'
import { ItemRef } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  const getQuotes = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.feed.getQuotes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      console.log('getPostQuotes', 'starting')
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      console.log('getPostQuotes', 'hydrateCtx', hydrateCtx)
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
  console.log('getPostQuotes', 'skeleton')
  const { ctx, params } = inputs
  if (clearlyBadCursor(params.cursor)) {
    return { refs: [] }
  }

  const quotesRes = await ctx.hydrator.dataplane.getQuotesBySubject({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })

  return {
    refs: quotesRes.refs,
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydratePosts(skeleton.refs, params.hydrateCtx)
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.refs = skeleton.refs.filter((ref) => {
    return !ctx.views.viewerBlockExists(ref.uri, hydration)
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
  const postViews = mapDefined(skeleton.refs, (ref) => {
    return ctx.views.post(ref.uri, hydration)
  })
  console.log('getPostQuotes', 'presentation', postViews)
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

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  refs: ItemRef[]
  cursor?: string
}
