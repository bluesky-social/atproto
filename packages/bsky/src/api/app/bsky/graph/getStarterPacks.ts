import { dedupeStrs, mapDefined } from '@atproto/common'

import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getStarterPacks.js'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline.js'

type Skeleton = { uris: string[] }

export default function (server: Server, ctx: AppContext) {
  const getStarterPacks = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )

  server.app.bsky.graph.getStarterPacks({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)

      return getStarterPacks({ viewer, labelers, includeTakedowns }, params)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ params }) => {
  return { uris: params.uris }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateStarterPacksBasic(
    dedupeStrs(skeleton.uris),
    ctx.hydrateCtx,
  )
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const starterPacks = mapDefined(skeleton.uris, (did) =>
    ctx.views.starterPackBasic(did, hydration),
  )
  return { starterPacks }
}
