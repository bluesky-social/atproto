import { mapDefined } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { DataPlaneClient } from '../../../../data-plane'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { app } from '../../../../lexicons/index.js'
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
  const searchActorsTypeahead = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.add(app.bsky.actor.searchActorsTypeahead, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const results = await searchActorsTypeahead(
        { ...params, hydrateCtx },
        ctx,
      )
      return {
        encoding: 'application/json',
        body: results,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const term = params.q ?? params.term ?? ''

  // @TODO
  // add typeahead option
  // add hits total

  if (ctx.searchClient) {
    const { actors } = await ctx.searchClient.call(
      app.bsky.unspecced.searchActorsSkeleton,
      {
        typeahead: true,
        q: term,
        limit: params.limit,
        viewer: params.hydrateCtx.viewer ?? undefined,
      },
    )
    return {
      dids: actors.map(({ did }) => did),
    }
  }

  const res = await ctx.dataplane.searchActors({
    term,
    limit: params.limit,
  })
  return {
    dids: res.dids as DidString[],
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateProfilesBasic(skeleton.dids, params.hydrateCtx)
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration, params } = inputs
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

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileBasic(did, hydration),
  )
  return {
    actors,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  searchClient?: Client
}

type Params = app.bsky.actor.searchActorsTypeahead.Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  dids: DidString[]
}
