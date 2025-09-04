import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/bookmark/getModBookmarksBySubject'
import {
  HydrationFnInput,
  PresentationFnInput,
  SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline'
import { Bookmark, StashRef } from '../../../../proto/bsky_pb'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getModBookmarksBySubject = createPipeline(
    skeleton,
    hydration,
    noRules, // Blocks are included and handled on views. Mutes are included.
    presentation,
  )
  server.app.bsky.bookmark.getModBookmarksBySubject({
    auth: ctx.authVerifier.modService,
    handler: async ({ params, req }) => {
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer: null,
      })

      const result = await getModBookmarksBySubject(
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
  const subjectUri = params.subject
  const { bookmarks, cursor } =
    await ctx.hydrator.dataplane.getBookmarksBySubject({
      subject: { uri: subjectUri },
      limit: params.limit,
      cursor: params.cursor,
    })
  return {
    subjectUri,
    bookmarks: bookmarks.filter((b): b is BookmarkWithRef => !!b.ref),
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { bookmarks } = skeleton
  return ctx.hydrator.hydrateProfiles(
    bookmarks.map((b) => b.ref.actorDid),
    params.hydrateCtx,
  )
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { bookmarks, cursor } = skeleton
  const bookmarkViews = mapDefined(bookmarks, (b) => {
    if (!b.indexedAt) return

    const profile = ctx.views.profile(b.ref?.actorDid, hydration)
    if (!profile) return

    return {
      indexedAt: b.indexedAt.toDate().toISOString(),
      actor: profile,
    }
  })
  return { bookmarks: bookmarkViews, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type BookmarkWithRef = Bookmark & { ref: StashRef }

type SkeletonState = {
  subjectUri: string
  bookmarks: BookmarkWithRef[]
  cursor?: string
}
