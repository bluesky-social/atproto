import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getVouchesIssued'
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
  const getVouchesIssued = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getVouchesIssued({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })

      const result = await getVouchesIssued({ ...params, hydrateCtx }, ctx)

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
  const [issuerDid] = await ctx.hydrator.actor.getDidsDefined([params.issuer])
  if (!issuerDid) {
    throw new InvalidRequestError(`Issuer not found: ${params.issuer}`)
  }
  if (clearlyBadCursor(params.cursor)) {
    return { issuerDid, receiverDids: [] }
  }
  const { vouches, cursor } = await ctx.hydrator.graph.getActorVouchesIssued({
    issuerDid,
    cursor: params.cursor,
    limit: params.limit,
  })
  return {
    issuerDid,
    receiverDids: vouches.map((v) => v.receiverDid),
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  // @TODO: Finish, hydrate vouches.
  const { ctx, params, skeleton } = input
  const { issuerDid, receiverDids } = skeleton
  const dids = [issuerDid, ...receiverDids]
  const profileState = await ctx.hydrator.hydrateProfiles(
    dids,
    params.hydrateCtx,
  )
  return profileState
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  // @TODO: Finish, consider vouch blocks and viewer blocks. Remove self-vouches.
  const { skeleton } = input
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  // @TODO: Finish, check takedowns and noHosted.
  const { ctx, hydration, skeleton, params } = input
  const { issuerDid, receiverDids, cursor } = skeleton

  const issuer = ctx.views.profile(issuerDid, hydration)
  if (!issuer) {
    throw new InvalidRequestError(`Issuer not found: ${params.issuer}`)
  }

  const vouches = mapDefined(receiverDids, (receiverDid) => {
    return ctx.views.profile(receiverDid, hydration)
  })

  return { vouches, issuer, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  issuerDid: string
  receiverDids: string[]
  cursor?: string
}
