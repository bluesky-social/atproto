import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getKnownFollowers'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getKnownFollowers = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getKnownFollowers({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
      })

      const result = await getKnownFollowers(
        { ...params, hydrateCtx: hydrateCtx.copy({ viewer }) },
        ctx,
      )

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
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
    return { subjectDid, knownFollowers: [], cursor: undefined }
  }

  const res = await ctx.hydrator.dataplane.getFollowsFollowing({
    actorDid: params.hydrateCtx.viewer,
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

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { knownFollowers } = skeleton
  const profilesState = await ctx.hydrator.hydrateProfiles(
    knownFollowers.concat(skeleton.subjectDid),
    params.hydrateCtx,
  )
  return profilesState
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, hydration, ctx } = input
  skeleton.knownFollowers = skeleton.knownFollowers.filter((did) => {
    return !ctx.views.viewerBlockExists(did, hydration)
  })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { knownFollowers } = skeleton

  const followers = mapDefined(knownFollowers, (did) => {
    return ctx.views.profile(did, hydration)
  })
  const subject = ctx.views.profile(skeleton.subjectDid, hydration)!

  return { subject, followers, cursor: undefined }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx & { viewer: string }
}

type SkeletonState = {
  subjectDid: string
  knownFollowers: string[]
  cursor?: string
}
