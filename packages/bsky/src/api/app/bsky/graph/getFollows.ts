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
  createPipelineNew,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getFollows = createPipelineNew(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getFollows({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const viewer = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage

      const result = await getFollows(
        { ...params, viewer, canViewTakendownProfile },
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
  const result = await ctx.hydrator.graph.getActorFollows({
    did: subjectDid,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    subjectDid,
    followUris: result.uris,
    cursor: result.cursor,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { followUris, subjectDid } = skeleton
  // @TODO hydrate follows w/ block info
  const follows = await ctx.hydrator.graph.getFollows(followUris, {
    disallowBlock: true,
  })
  const dids = [subjectDid]
  for (const follow of follows.values()) {
    if (follow) {
      dids.push(follow.record.subject)
    }
  }
  const profileState = await ctx.hydrator.hydrateProfiles(dids, viewer)
  return { ...profileState, follows }
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration, ctx } = input
  const { viewer } = params
  if (viewer) {
    skeleton.followUris = skeleton.followUris.filter((followUri) => {
      const follow = hydration.follows?.get(followUri)
      if (!follow) return true
      return !ctx.views.viewerBlockExists(follow.record.subject, hydration)
    })
  }
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
  if (
    !subject ||
    (!params.canViewTakendownProfile && isTakendown(subjectDid))
  ) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const follows = mapDefined(followUris, (followUri) => {
    const followDid = hydration.follows?.get(followUri)?.record.subject
    if (!followDid) return
    if (!params.canViewTakendownProfile && isTakendown(followDid)) {
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
  canViewTakendownProfile: boolean
}

type SkeletonState = {
  subjectDid: string
  followUris: string[]
  cursor?: string
}
