import { mapDefined } from '@atproto/common'

import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getBlocks.js'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  blockedDids: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getBlocks({
    auth: ctx.authVerifier.standard,
    handler: ctx.createPipelineHandler(
      skeleton,
      hydration,
      noRules,
      presentation,
    ),
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { blockedDids: [] }
  }

  const actorDid = ctx.hydrateCtx.viewer
  if (!actorDid) throw new InvalidRequestError('Unauthorized')

  const { blockUris, cursor } = await ctx.hydrator.dataplane.getBlocks({
    actorDid,
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

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateProfiles(skeleton.blockedDids, ctx.hydrateCtx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const { blockedDids, cursor } = skeleton
  const blocks = mapDefined(blockedDids, (did) => {
    return ctx.views.profile(did, hydration)
  })
  return { blocks, cursor }
}
