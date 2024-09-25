import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getStarterPack.js'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline.js'

type Skeleton = {
  uri: string
}

export default function (server: Server, ctx: AppContext) {
  const getStarterPack = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getStarterPack({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)

      return getStarterPack({ labelers, viewer, includeTakedowns }, params)
    },
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
  return ctx.hydrator.hydrateStarterPacks([skeleton.uri], ctx.hydrateCtx)
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
