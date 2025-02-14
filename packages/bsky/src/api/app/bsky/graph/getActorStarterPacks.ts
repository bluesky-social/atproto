import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getActorStarterPacks'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = {
  starterPackUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getActorStarterPacks({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
      {
        includeTakedowns: true,
      },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async (ctx) => {
  const [did] = await ctx.hydrator.actor.getDids([ctx.params.actor])
  if (!did) {
    throw new InvalidRequestError('Profile not found')
  }
  const starterPacks = await ctx.dataplane.getActorStarterPacks({
    actorDid: did,
    cursor: ctx.params.cursor,
    limit: ctx.params.limit,
  })
  return {
    starterPackUris: starterPacks.uris,
    cursor: parseString(starterPacks.cursor),
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async (ctx, skeleton) => {
  return ctx.hydrator.hydrateStarterPacksBasic(skeleton.starterPackUris, ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = (
  ctx,
  skeleton,
  hydration,
) => {
  const starterPacks = mapDefined(skeleton.starterPackUris, (uri) =>
    ctx.views.starterPackBasic(uri, hydration),
  )
  return {
    body: {
      starterPacks,
      cursor: skeleton.cursor,
    },
  }
}
