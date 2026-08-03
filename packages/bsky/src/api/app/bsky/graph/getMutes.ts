import { mapDefined } from '@atproto/common'
import type { DidString } from '@atproto/lex'
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
import type { Views } from '../../../../views/index.js'
import { clearlyBadCursor, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getMutes = createPipeline(skeleton, hydration, noRules, presentation)
  server.add(app.bsky.graph.getMutes, {
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const result = await getMutes({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

// Bounds dataplane round trips per request when filling pages. A page can
// only run short when it contains scoped mutes, so this is only reached by
// viewers with many consecutive scoped mutes; the client just paginates
// again from the returned cursor.
const MAX_PAGE_FILL_FETCHES = 10

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (clearlyBadCursor(params.cursor)) {
    return { mutedDids: [] }
  }
  // only fully muted accounts are enumerated: scoped mutes (only reposts /
  // only quoteposts) are filtered out. Since scoped entries still consume
  // cursor range, keep fetching until the page holds at least `limit` full
  // mutes. Whole dataplane pages are appended, so the response may exceed
  // `limit`; this keeps the returned cursor a plain dataplane cursor.
  const mutedDids: DidString[] = []
  let cursor = params.cursor
  for (let i = 0; i < MAX_PAGE_FILL_FETCHES; i++) {
    const res = await ctx.hydrator.dataplane.getMutes({
      actorDid: params.hydrateCtx.viewer,
      cursor,
      limit: params.limit,
    })
    const fullMuteDids = res.mutes.length
      ? res.mutes
          .filter((mute) => !mute.onlyReposts && !mute.onlyQuoteposts)
          .map((mute) => mute.did)
      : res.dids
    mutedDids.push(...(fullMuteDids as DidString[]))
    cursor = res.cursor || undefined
    if (!cursor || mutedDids.length >= params.limit) break
  }
  return { mutedDids, cursor }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { mutedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(mutedDids, params.hydrateCtx)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { mutedDids, cursor } = skeleton
  const mutes = mapDefined(mutedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { mutes, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = app.bsky.graph.getMutes.$Params & {
  hydrateCtx: HydrateCtxWithViewer
}

type SkeletonState = {
  mutedDids: DidString[]
  cursor?: string
}
