import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getStarterPack'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  uri: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getStarterPack({
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

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  const uri = await ctx.hydrator.resolveUri(params.starterPack)
  return { uri }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateStarterPacks([skeleton.uri], ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const starterPack = ctx.views.starterPack(skeleton.uri, hydration)
  if (!starterPack) {
    throw new InvalidRequestError('Starter pack not found')
  }
  return { starterPack }
}
