import { AtpAgent } from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/searchActors'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const searchActors = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.actor.searchActors({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        includeTakedowns,
      })
      const results = await searchActors({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: results,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs
  const term = params.q ?? params.term ?? ''

  // @TODO
  // add hits total

  if (ctx.searchAgent) {
    // @NOTE cursors won't change on appview swap
    const { data: res } =
      await ctx.searchAgent.app.bsky.unspecced.searchActorsSkeleton({
        q: term,
        cursor: params.cursor,
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
      })
    return {
      dids: res.actors.map(({ did }) => did),
      cursor: parseString(res.cursor),
    }
  }

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
  return ctx.hydrator.hydrateProfiles(skeleton.dids, params.hydrateCtx)
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
  searchAgent?: AtpAgent
}

type Params = QueryParams & { hydrateCtx: HydrateCtx }

type Skeleton = {
  dids: string[]
  hitsTotal?: number
  cursor?: string
}
