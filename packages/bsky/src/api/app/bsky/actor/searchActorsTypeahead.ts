import { mapDefined } from '@atproto/common'
import { Client, DidString } from '@atproto/lex'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { DataPlaneClient } from '../../../../data-plane/index.js'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline.js'
import { Views } from '../../../../views/index.js'
import { resHeaders, resolveSearchV2Override } from '../../../util.js'

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
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        features: ctx.featureGatesClient.scope(
          ctx.featureGatesClient.parseUserContextFromHandler({
            viewer,
            req,
          }),
        ),
      })
      const results = await searchActorsTypeahead(
        {
          ...params,
          hydrateCtx,
          isV2Override: resolveSearchV2Override(req, ctx.cfg),
        },
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

const skeletonV1 = async (
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

const skeletonV2 = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  const { ctx, params } = inputs
  const term = params.q ?? params.term ?? ''

  const res = await ctx.dataplane.searchActorsTypeahead({
    params: {
      query: term,
      viewer: params.hydrateCtx.viewer ?? undefined,
      limit: params.limit,
    },
  })
  return {
    dids: res.actors.map(({ did }) => did as DidString),
  }
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const useV2 =
    input.params.hydrateCtx.features.checkGate(
      input.params.hydrateCtx.features.Gate.SearchV2Enable,
    ) || input.params.isV2Override
  const skeletonFn = useV2 ? skeletonV2 : skeletonV1
  return skeletonFn(input)
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

type Params = app.bsky.actor.searchActorsTypeahead.$Params & {
  hydrateCtx: HydrateCtx
  isV2Override: boolean
}

type Skeleton = {
  dids: DidString[]
}
