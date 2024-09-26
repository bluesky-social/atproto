import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getKnownFollowers'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  subjectDid: string
  knownFollowers: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getKnownFollowers({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noBlocks,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  const [subjectDid] = await ctx.hydrator.actor.getDidsDefined([params.actor])
  if (!subjectDid) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const actorDid = ctx.viewer
  if (!actorDid) throw new InvalidRequestError('Unauthorized')

  if (clearlyBadCursor(params.cursor)) {
    return { subjectDid, knownFollowers: [], cursor: undefined }
  }

  const res = await ctx.hydrator.dataplane.getFollowsFollowing({
    actorDid,
    targetDids: [subjectDid],
  })
  const result = res.results.at(0)
  const knownFollowers = result ? result.dids.slice(0, params.limit) : []

  return {
    subjectDid,
    knownFollowers,
    cursor: undefined,
  }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  const { knownFollowers } = skeleton
  const profilesState = await ctx.hydrator.hydrateProfiles(
    knownFollowers.concat(skeleton.subjectDid),
    ctx,
  )
  return profilesState
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  skeleton,
  hydration,
  ctx,
}) => {
  skeleton.knownFollowers = skeleton.knownFollowers.filter((did) => {
    return !ctx.views.viewerBlockExists(did, hydration)
  })
  return skeleton
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const { knownFollowers } = skeleton

  const followers = mapDefined(knownFollowers, (did) => {
    return ctx.views.profile(did, hydration)
  })
  const subject = ctx.views.profile(skeleton.subjectDid, hydration)!

  return { subject, followers, cursor: undefined }
}
