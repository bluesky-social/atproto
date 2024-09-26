import { dedupeStrs, mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getStarterPacks'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = { uris: string[] }

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getStarterPacks({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
      { allowIncludeTakedowns: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ params }) => {
  return { uris: params.uris }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateStarterPacksBasic(dedupeStrs(skeleton.uris), ctx)
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
