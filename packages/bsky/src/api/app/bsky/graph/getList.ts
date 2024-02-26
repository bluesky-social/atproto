import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getList'
import AppContext from '../../../../context'
import {
  createPipeline,
  HydrationFnInput,
  noRules,
  PresentationFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import {
  HydrateCtx,
  Hydrator,
  mergeStates,
} from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { clearlyBadCursor } from '../../../util'
import { ListItemInfo } from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  const getList = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = { labelers, viewer }
      const result = await getList({ ...params, hydrateCtx }, ctx)
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
    return { listUri: params.list, listitems: [] }
  }
  const { listitems, cursor } = await ctx.hydrator.dataplane.getListMembers({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    listUri: params.list,
    listitems,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { listUri, listitems } = skeleton
  const [listState, profileState] = await Promise.all([
    ctx.hydrator.hydrateLists([listUri], params.hydrateCtx),
    ctx.hydrator.hydrateProfiles(
      listitems.map(({ did }) => did),
      params.hydrateCtx,
    ),
  ])
  return mergeStates(listState, profileState)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUri, listitems, cursor } = skeleton
  const list = ctx.views.list(listUri, hydration)
  const items = mapDefined(listitems, ({ uri, did }) => {
    const subject = ctx.views.profile(did, hydration)
    if (!subject) return
    return { uri, subject }
  })
  if (!list) {
    throw new InvalidRequestError('List not found')
  }
  return { list, items, cursor }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  hydrateCtx: HydrateCtx
}

type SkeletonState = {
  listUri: string
  listitems: ListItemInfo[]
  cursor?: string
}
