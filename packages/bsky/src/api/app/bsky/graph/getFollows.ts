import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getFollowers'
import AppContext from '../../../../context'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Hydrator, mergeStates } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { clearlyBadCursor } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getFollows = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth }) => {
      const { viewer, canViewTakedowns } = ctx.authVerifier.parseCreds(auth)

      // @TODO ensure canViewTakedowns gets threaded through and applied properly
      const result = await getFollows(
        { ...params, viewer, canViewTakedowns },
        ctx,
      )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
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

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
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
  const profileState = await ctx.hydrator.hydrateProfiles(dids, viewer)
  return mergeStates(followState, profileState)
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration, ctx } = input
  const { viewer } = params
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

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton, params } = input
  const { subjectDid, followUris, cursor } = skeleton
  const isTakendown = (did: string) =>
    ctx.views.actorIsTakendown(did, hydration)

  const subject = ctx.views.profile(subjectDid, hydration)
  if (!subject || (!params.canViewTakedowns && isTakendown(subjectDid))) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const follows = mapDefined(followUris, (followUri) => {
    const followDid = hydration.follows?.get(followUri)?.record.subject
    if (!followDid) return
    if (!params.canViewTakedowns && isTakendown(followDid)) {
      return
    }
    return ctx.views.profile(followDid, hydration)
  })

  return { follows, subject, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string | null
  canViewTakedowns: boolean
}

type SkeletonState = {
  subjectDid: string
  followUris: string[]
  cursor?: string
}
