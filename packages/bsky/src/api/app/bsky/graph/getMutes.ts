import { mapDefined } from '@atproto/common'
import { StandardOutput } from '../../../../auth-verifier'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getMutes'
import {
  HydrationFn,
  PresentationFn,
  SkeletonFn,
  noRules,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  mutedDids: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getMutes({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams, StandardOutput> = async (
  ctx,
) => {
  if (clearlyBadCursor(ctx.params.cursor)) {
    return { mutedDids: [] }
  }

  const { dids, cursor } = await ctx.hydrator.dataplane.getMutes({
    actorDid: ctx.viewer,
    cursor: ctx.params.cursor,
    limit: ctx.params.limit,
  })
  return {
    mutedDids: dids,
    cursor: cursor || undefined,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateProfiles(skeleton.mutedDids, ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const { mutedDids, cursor } = skeleton
  const mutes = mapDefined(mutedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { body: { mutes, cursor } }
}
