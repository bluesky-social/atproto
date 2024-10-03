import { mapDefined } from '@atproto/common'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import { ids } from '../../../../lexicon/lexicons'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'

type Skeleton = { dids: string[] }

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.standardOptionalParameterized({
      lxmCheck: (method) => {
        if (!method) return false
        return (
          method === ids.AppBskyActorGetProfiles ||
          method.startsWith('chat.bsky.')
        )
      },
    }),
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
      { exposeRepoRev: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  const dids = await ctx.hydrator.actor.getDidsDefined(params.actors)
  return { dids }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateProfilesDetailed(skeleton.dids, ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const profiles = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileDetailed(did, hydration),
  )
  return { body: { profiles } }
}
