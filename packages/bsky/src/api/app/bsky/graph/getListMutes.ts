import { mapDefined } from '@atproto/common'

import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context.js'
import { Server } from '../../../../lexicon/index.js'
import {
  OutputSchema,
  QueryParams,
} from '../../../../lexicon/types/app/bsky/graph/getListMutes.js'
import {
  HydrationFn,
  noRules,
  PresentationFn,
  SkeletonFn,
} from '../../../../pipeline.js'
import { clearlyBadCursor } from '../../../util.js'

type Skeleton = {
  listUris: string[]
  cursor?: string
}

export default function (server: Server, ctx: AppContext) {
  const getListMutes = ctx.createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )

  server.app.bsky.graph.getListMutes({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      return getListMutes({ labelers, viewer }, params)
    },
  })
}

const skeleton: SkeletonFn<Skeleton, QueryParams> = async ({ ctx, params }) => {
  if (clearlyBadCursor(params.cursor)) {
    return { listUris: [] }
  }

  const actorDid = ctx.hydrateCtx.viewer
  if (!actorDid) throw new InvalidRequestError('An actor is required')

  const { listUris, cursor } =
    await ctx.hydrator.dataplane.getMutelistSubscriptions({
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
  return ctx.hydrator.hydrateLists(skeleton.listUris, ctx.hydrateCtx)
}

const presentation: PresentationFn<Skeleton, QueryParams, OutputSchema> = ({
  ctx,
  skeleton,
  hydration,
}) => {
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => ctx.views.list(uri, hydration))
  return { lists, cursor }
}
