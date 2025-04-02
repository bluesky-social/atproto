import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { HydrateCtx, Hydrator } from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getVouchesReceived'
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
  const getVouchesReceived = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.graph.getVouchesReceived({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })

      const result = await getVouchesReceived({ ...params, hydrateCtx }, ctx)

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
  const [receiverDid] = await ctx.hydrator.actor.getDidsDefined([
    params.receiver,
  ])
  if (!receiverDid) {
    throw new InvalidRequestError(`Receiver not found: ${params.receiver}`)
  }
  if (clearlyBadCursor(params.cursor)) {
    return { receiverDid, issuerDids: [] }
  }
  const { vouchers, cursor } = await ctx.hydrator.graph.getActorVouchesReceived(
    {
      receiverDid,
      cursor: params.cursor,
      limit: params.limit,
    },
  )
  return {
    receiverDid,
    issuerDids: vouchers.map((v) => v.issuerDid),
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  // @TODO: Finish, hydrate vouches.
  const { ctx, params, skeleton } = input
  const { receiverDid, issuerDids } = skeleton
  const dids = [receiverDid, ...issuerDids]
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
  const { receiverDid, issuerDids, cursor } = skeleton

  const receiver = ctx.views.profile(receiverDid, hydration)
  if (!receiver) {
    throw new InvalidRequestError(`Receiver not found: ${params.receiver}`)
  }

  const vouchers = mapDefined(issuerDids, (issuerDid) => {
    return ctx.views.profile(issuerDid, hydration)
  })

  return { vouchers, receiver, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  receiverDid: string
  issuerDids: string[]
  cursor?: string
}
