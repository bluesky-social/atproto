import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/bookmark/getModBookmarksByActor'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { BookmarkInfo } from '../../../../proto/bsky_pb'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getModBookmarksByActor = createPipeline(
    skeleton,
    hydration,
    noRules, // Blocks are included and handled on views. Mutes are included.
    presentation,
  )
  server.app.bsky.bookmark.getModBookmarksByActor({
    auth: ctx.authVerifier.modService,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })

      const result = await getModBookmarksByActor(
        { ...params, hydrateCtx },
        ctx,
      )

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
  const actorDid = params.actor
  const { bookmarks, cursor } = await ctx.hydrator.dataplane.getActorBookmarks({
    actorDid,
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
  return ctx.hydrator.hydrateBookmarks(
    bookmarkInfos,
    params.actor,
    params.hydrateCtx,
  )
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, params, skeleton } = input
  const { bookmarkInfos, cursor } = skeleton
  const bookmarkViews = mapDefined(bookmarkInfos, (bookmarkInfo) =>
    ctx.views.bookmark(bookmarkInfo.key, params.actor, hydration),
  )
  return { bookmarks: bookmarkViews, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  actorDid: string
  bookmarkInfos: BookmarkInfo[]
  cursor?: string
}
