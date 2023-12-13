import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/searchActors'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipelineNew,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { cleanQuery } from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  const searchActors = createPipelineNew(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.actor.searchActors({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.did
      const results = await searchActors({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const rawQuery = params.q ?? params.term
  const term = cleanQuery(rawQuery || '')

  // @TODO
  // add hits total

  const res = await ctx.dataplane.searchActors({
    term,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    dids: res.dids,
    cursor: parseString(res.cursor),
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateProfiles(skeleton.dids, params.viewer)
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.dids = skeleton.dids.filter(
    (did) => !ctx.views.viewerBlockExists(did, hydration),
  )
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profile(did, hydration),
  )
  return {
    actors,
    cursor: skeleton.cursor,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  dids: string[]
  hitsTotal?: number
  cursor?: string
}
