import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getFollowers'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getFollowers = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })

      const result = await getFollowers({ ...params, hydrateCtx }, ctx)

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
    return { subjectDid, followUris: [] }
  }
  const { followers, cursor } = await ctx.hydrator.graph.getActorFollowers({
    did: subjectDid,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    subjectDid,
    followUris: followers.map((f) => f.uri),
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { followUris, subjectDid } = skeleton
  const followState = await ctx.hydrator.hydrateFollows(followUris)
  const dids = [subjectDid]
  if (followState.follows) {
    for (const [uri, follow] of followState.follows) {
      if (follow) {
        dids.push(didFromUri(uri))
      }
    }
  }
  const profileState = await ctx.hydrator.hydrateProfiles(
    dids,
    params.hydrateCtx,
  )
  return mergeStates(followState, profileState)
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration, ctx } = input
  const viewer = params.hydrateCtx.viewer
  skeleton.followUris = skeleton.followUris.filter((followUri) => {
    const followerDid = didFromUri(followUri)
    return (
      !hydration.followBlocks?.get(followUri) &&
      (!viewer || !ctx.views.viewerBlockExists(followerDid, hydration))
    )
  })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton, params } = input
  const { subjectDid, followUris, cursor } = skeleton
  const isNoHosted = (did: string) => ctx.views.actorIsNoHosted(did, hydration)

  const subject = ctx.views.profile(subjectDid, hydration)
  if (
    !subject ||
    (!params.hydrateCtx.includeTakedowns && isNoHosted(subjectDid))
  ) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const followers = mapDefined(followUris, (followUri) => {
    const followerDid = didFromUri(followUri)
    if (!params.hydrateCtx.includeTakedowns && isNoHosted(followerDid)) {
      return
    }
    return ctx.views.profile(didFromUri(followUri), hydration)
  })

  return { followers, subject, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  subjectDid: string
  followUris: string[]
  cursor?: string
}
