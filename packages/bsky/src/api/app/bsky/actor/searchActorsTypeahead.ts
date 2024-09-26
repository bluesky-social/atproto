import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/actor/searchActorsTypeahead'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  dids: string[]
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  const term = params.q ?? params.term ?? ''

  // @TODO
  // add typeahead option
  // add hits total

  if (ctx.searchAgent) {
    const { data: res } =
      await ctx.searchAgent.app.bsky.unspecced.searchActorsSkeleton({
        typeahead: true,
        q: term,
        limit: params.limit,
        viewer: ctx.viewer ?? undefined,
      })
    return {
      dids: res.actors.map(({ did }) => did),
      cursor: parseString(res.cursor),
    }
  }

  const res = await ctx.dataplane.searchActors({
    term,
    limit: params.limit,
  })
  return {
    dids: res.dids,
    cursor: parseString(res.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateProfilesBasic(skeleton.dids, ctx)
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  ctx,
  skeleton,
  hydration,
  params,
}) => {
  skeleton.dids = skeleton.dids.filter((did) => {
    const actor = hydration.actors?.get(did)
    if (!actor) return false
    // Always display exact matches so that users can find profiles that they have blocked
    const term = (params.q ?? params.term ?? '').toLowerCase()
    const isExactMatch = actor.handle?.toLowerCase() === term
    return isExactMatch || !ctx.views.viewerBlockExists(did, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileBasic(did, hydration),
  )
  return { actors }
}
