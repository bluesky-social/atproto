import { mapDefined } from '@atproto/common'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type {
  HydrateCtxWithViewer,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import type { BookmarkInfo } from '../../../../proto/bsky_pb.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getBookmarks = createPipeline(
    skeleton,
    hydration,
    noRules, // Blocks are included and handled on views. Mutes are included.
    presentation,
  )
  server.add(app.bsky.bookmark.getBookmarks, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })

      const result = await getBookmarks({ ...params, hydrateCtx }, ctx)

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  const actorDid = params.hydrateCtx.viewer
  const { bookmarks, cursor } = await ctx.hydrator.dataplane.getActorBookmarks({
    actorDid: params.hydrateCtx.viewer,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    actorDid,
    bookmarkInfos: bookmarks,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { bookmarkInfos } = skeleton
  return ctx.hydrator.hydrateBookmarks(bookmarkInfos, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { bookmarkInfos, cursor } = skeleton
  const bookmarkViews = mapDefined(bookmarkInfos, (bookmarkInfo) =>
    ctx.views.bookmark(bookmarkInfo.key, hydration),
  )
  return { bookmarks: bookmarkViews, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.bookmark.getBookmarks.$Params & {
  hydrateCtx: HydrateCtxWithViewer
}

type SkeletonState = {
  actorDid: string
  bookmarkInfos: BookmarkInfo[]
  cursor?: string
}
