import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getLists'
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
  const getLists = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const result = await getLists({ ...params, viewer }, ctx)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { ctx, params } = input
  if (clearlyBadCursor(params.cursor)) {
    return { listUris: [] }
  }
  const { listUris, cursor } = await ctx.hydrator.dataplane.getActorLists({
    actorDid: params.actor,
    cursor: params.cursor,
    limit: params.limit,
  })
  return { listUris, cursor: cursor || undefined }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { listUris } = skeleton
  return ctx.hydrator.hydrateLists(listUris, viewer)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUris, cursor } = skeleton
  const lists = mapDefined(listUris, (uri) => {
    return ctx.views.list(uri, hydration)
  })
  return { lists, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string | null
}

type SkeletonState = {
  listUris: string[]
  cursor?: string
}
