import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { mergeStates } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getFollows.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  subjectDid: string
  followUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
      { enforceIncludeTakedowns: true },
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  const [subjectDid] = await ctx.hydrator.actor.getDidsDefined([params.actor])
  if (!subjectDid) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }
  if (clearlyBadCursor(params.cursor)) {
    return { subjectDid, followUris: [] }
  }
  const { follows, cursor } = await ctx.hydrator.graph.getActorFollows({
    did: subjectDid,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    subjectDid,
    followUris: follows.map((f) => f.uri),
    cursor: cursor || undefined,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  const { followUris, subjectDid } = skeleton
  const followState = await ctx.hydrator.hydrateFollows(followUris)
  const dids = [subjectDid]
  if (followState.follows) {
    for (const follow of followState.follows.values()) {
      if (follow) {
        dids.push(follow.record.subject)
      }
    }
  }
  const profileState = await ctx.hydrator.hydrateProfiles(dids, ctx)
  return mergeStates(followState, profileState)
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  skeleton,
  hydration,
  ctx,
}) => {
  const { viewer } = ctx
  skeleton.followUris = skeleton.followUris.filter((followUri) => {
    const follow = hydration.follows?.get(followUri)
    if (!follow) return false
    return (
      !hydration.followBlocks?.get(followUri) &&
      (!viewer ||
        !ctx.views.viewerBlockExists(follow.record.subject, hydration))
    )
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  params,
  skeleton,
  hydration,
}) => {
  const { subjectDid, followUris, cursor } = skeleton
  const isNoHosted = (did: string) => ctx.views.actorIsNoHosted(did, hydration)

  const subject = ctx.views.profile(subjectDid, hydration)
  if (!subject || (!ctx.includeTakedowns && isNoHosted(subjectDid))) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const follows = mapDefined(followUris, (followUri) => {
    const followDid = hydration.follows?.get(followUri)?.record.subject
    if (!followDid) return
    if (!ctx.includeTakedowns && isNoHosted(followDid)) {
      return
    }
    return ctx.views.profile(followDid, hydration)
  })

  return { follows, subject, cursor }
}
