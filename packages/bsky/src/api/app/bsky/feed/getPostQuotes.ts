import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import AppContext from '../../../../context'
import { createPipeline } from '../../../../pipeline'
import { clearlyBadCursor, resHeaders } from '../../../util'
import { HydrationState, Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { mapDefined } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  const getPostQuotes = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getPostQuotes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getPostQuotes({ ...params, viewer }, ctx)

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
    return { feedItems: [] }
  }

  const quotesRes = await ctx.hydrator.dataplane.getQuotesBySubject({
    subject: { uri: params.uri, cid: params.cid },
    cursor: params.cursor,
    limit: params.limit,
  })

  return {
    feedItems: quotesRes.uris,
  }
}

const hydration = async (inputs: {
  ctx: Context
  params: Params
  skeleton: Skeleton
}) => {
  const { ctx, params, skeleton } = inputs
  return await ctx.hydrator.hydratePosts(skeleton.feedItems, params.hydrateCtx)
}

const noBlocks = (inputs: {
  ctx: Context
  skeleton: Skeleton
  hydration: HydrationState
}) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.feedItems = skeleton.feedItems.filter((item) => {
    return !ctx.views.viewerBlockExists(item.postAuthorDid, hydration)
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
  const postViews = mapDefined(skeleton.feedItems, (uri) => {
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

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  feedItems: any[] // @TODO
  cursor?: string
}
