import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getVouchesGiven'
import AppContext from '../../../../context'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import {
  HydrateCtx,
  Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { resHeaders } from '../../../util'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { DataPlaneClient } from '../../../../data-plane'

export default function (server: Server, ctx: AppContext) {
  const getVouchesGiven = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getVouchesGiven({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })

      const result = await getVouchesGiven({ ...params, hydrateCtx }, ctx)

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
  const [actorDid] = await ctx.hydrator.actor.getDidsDefined([params.actor])
  if (!actorDid) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }
  if (params.state !== 'accepted' && actorDid !== params.hydrateCtx.viewer) {
    throw new InvalidRequestError(
      'Cannot request unaccepeted vouches for an actor other than oneself',
    )
  }
  const { uris, cursor } = await ctx.dataplane.getVouchesGiven({
    actorDid,
    state: params.state,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    vouchUris: uris,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { vouchUris } = skeleton
  const vouchState = await ctx.hydrator.hydrateVouches(
    vouchUris,
    params.hydrateCtx,
  )
  const profileDids = mapDefined(
    vouchUris,
    (uri) => vouchState.vouches?.get(uri)?.vouch.record.subject,
  )
  const profilesState = await ctx.hydrator.hydrateProfilesBasic(
    profileDids,
    params.hydrateCtx.copy({ excludeVouches: true }),
  )
  return mergeStates(vouchState, profilesState)
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, params, hydration, ctx } = input
  const viewer = params.hydrateCtx.viewer
  // @TODO
  // skeleton.vouchUris = skeleton.vouchUris.filter((vouchUri) => {
  //   const vouch = hydration.vouches?.get(vouchUri)
  //   if (!vouch) return false
  //   return (
  //     !hydration.followBlocks?.get(vouchUri) &&
  //     (!viewer ||
  //       !ctx.views.viewerBlockExists(follow.record.subject, hydration))
  //   )
  // })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton, params } = input
  const { vouchUris, cursor } = skeleton
  const isNoHosted = (did: string) => ctx.views.actorIsNoHosted(did, hydration)

  const vouches = mapDefined(vouchUris, (vouchUri) => {
    const subjectDid = hydration.vouches?.get(vouchUri)?.vouch.record.subject
    if (!subjectDid) return
    const voucherDid = didFromUri(vouchUri)
    if (
      !params.hydrateCtx.includeTakedowns &&
      (isNoHosted(voucherDid) || isNoHosted(subjectDid))
    ) {
      return
    }
    const vouch = ctx.views.vouch(vouchUri, hydration)
    const subject = ctx.views.profileBasic(subjectDid, hydration)
    if (!vouch || !subject) return
    return { subject, vouch }
  })

  return { vouches, cursor }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  vouchUris: string[]
  cursor?: string
}
