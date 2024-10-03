import { mapDefined } from '@atproto/common'

import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon/index'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getListBlocks'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline'
import { clearlyBadCursor } from '../../../util'

type Skeleton = {
  listUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getListBlocks({
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
    return { listUris: [] }
  }

  const actorDid = ctx.viewer
  if (!actorDid) throw new InvalidRequestError('An actor is required')

  const { listUris, cursor } =
    await ctx.hydrator.dataplane.getBlocklistSubscriptions({
      actorDid,
      cursor: params.cursor,
      limit: params.limit,
    })
  return { listUris, cursor: cursor || undefined }
}

const hydration: HydrationFn<Skeleton, QueryParams> = async ({
  ctx,
  skeleton,
}) => {
  return ctx.hydrator.hydrateLists(skeleton.listUris, ctx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => ctx.views.list(uri, hydration))
  return { body: { lists, cursor } }
}
