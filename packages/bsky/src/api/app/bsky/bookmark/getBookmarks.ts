import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/bookmark/getBookmarks'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Bookmark, RecordRef } from '../../../../proto/bsky_pb'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getBookmarks = createPipeline(
    skeleton,
    hydration,
    noRules, // Blocks are included and handled on views. Mutes are included.
    presentation,
  )
  server.app.bsky.bookmark.getBookmarks({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })

      const result = await getBookmarks(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }) },
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
  const actorDid = params.hydrateCtx.viewer
  const { bookmarks, cursor } = await ctx.hydrator.dataplane.getActorBookmarks({
    actorDid: params.hydrateCtx.viewer,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    actorDid,
    bookmarks: bookmarks.filter((b): b is BookmarkWithSubject => !!b.subject),
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { bookmarks } = skeleton
  return ctx.hydrator.hydrateBookmarks(bookmarks, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { bookmarks, cursor } = skeleton
  const bookmarkViews = mapDefined(bookmarks, (bookmark) =>
    ctx.views.bookmark(bookmark.subject.uri, hydration),
  )
  return { bookmarks: bookmarkViews, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type BookmarkWithSubject = Bookmark & { subject: RecordRef }

type SkeletonState = {
  actorDid: string
  bookmarks: BookmarkWithSubject[]
  cursor?: string
}
