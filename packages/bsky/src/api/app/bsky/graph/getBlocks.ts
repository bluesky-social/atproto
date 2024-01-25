import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getBlocks'
import AppContext from '../../../../context'
import {
  createPipeline,
  HydrationFnInput,
  noRules,
  PresentationFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { clearlyBadCursor } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getBlocks = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getBlocks({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const result = await getBlocks({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (input: SkeletonFnInput<Context, Params>) => {
  const { params, ctx } = input
  if (clearlyBadCursor(params.cursor)) {
    return { blockedDids: [] }
  }
  const { blockUris, cursor } = await ctx.hydrator.dataplane.getBlocks({
    actorDid: params.viewer,
    cursor: params.cursor,
    limit: params.limit,
  })
  const blocks = await ctx.hydrator.graph.getBlocks(blockUris)
  const blockedDids = mapDefined(
    blockUris,
    (uri) => blocks.get(uri)?.record.subject,
  )
  return {
    blockedDids,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { blockedDids } = skeleton
  return ctx.hydrator.hydrateProfiles(blockedDids, viewer)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, hydration, skeleton } = input
  const { blockedDids, cursor } = skeleton
  const blocks = mapDefined(blockedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { blocks, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  blockedDids: string[]
  cursor?: string
}
