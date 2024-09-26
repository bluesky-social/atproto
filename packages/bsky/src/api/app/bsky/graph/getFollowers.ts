import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import { mergeStates } from '../../../../hydration/hydrator.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getFollowers.js'
import {
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { uriToDid as didFromUri } from '../../../../util/uris.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  subjectDid: string
  followUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
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

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
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
  const profileState = await ctx.hydrator.hydrateProfiles(dids, ctx.hydrateCtx)
  return mergeStates(followState, profileState)
}

const noBlocks: RulesFn<Skeleton, QueryParams> = ({
  skeleton,
  hydration,
  ctx,
}) => {
  const { viewer } = ctx.hydrateCtx
  skeleton.followUris = skeleton.followUris.filter((followUri) => {
    const followerDid = didFromUri(followUri)
    return (
      !hydration.followBlocks?.get(followUri) &&
      (!viewer || !ctx.views.viewerBlockExists(followerDid, hydration))
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
  if (
    !subject ||
    (!ctx.hydrateCtx.includeTakedowns && isNoHosted(subjectDid))
  ) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }

  const followers = mapDefined(followUris, (followUri) => {
    const followerDid = didFromUri(followUri)
    if (!ctx.hydrateCtx.includeTakedowns && isNoHosted(followerDid)) {
      return
    }
    return ctx.views.profile(didFromUri(followUri), hydration)
  })

  return { followers, subject, cursor }
}
