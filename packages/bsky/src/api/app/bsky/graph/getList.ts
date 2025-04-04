import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import {
  HydrateCtx,
  HydrationState,
  Hydrator,
  mergeManyStates,
} from '../../../../hydration/hydrator'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getList'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { ListItemInfo } from '../../../../proto/bsky_pb'
import { uriToDid as didFromUri } from '../../../../util/uris'
import { Views } from '../../../../views'
import { clearlyBadCursor, resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  const getList = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)

      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        includeTakedowns,
      })
      const result = await getList({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
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
  const bidirectionalBlocks = await maybeGetBlocksForReferenceAndCurateList({
    ctx,
    params,
    skeleton,
    listState,
  })
  return mergeManyStates(listState, profileState, { bidirectionalBlocks })
}

const noBlocks = (input: RulesFnInput<Context, Params, SkeletonState>) => {
  const { skeleton, hydration } = input
  const creator = didFromUri(skeleton.listUri)
  const blocks = hydration.bidirectionalBlocks?.get(creator)
  skeleton.listitems = skeleton.listitems.filter(({ did }) => {
    return !blocks?.get(did)
  })
  return skeleton
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

const maybeGetBlocksForReferenceAndCurateList = async (input: {
  ctx: Context
  listState: HydrationState
  skeleton: SkeletonState
  params: Params
}) => {
  const { ctx, params, listState, skeleton } = input
  const { listitems } = skeleton
  const { list } = params
  const listRecord = listState.lists?.get(list)
  const creator = didFromUri(list)
  if (
    params.hydrateCtx.viewer === creator ||
    listRecord?.record.purpose === 'app.bsky.graph.defs#modlist'
  ) {
    return
  }
  const pairs: Map<string, string[]> = new Map()
  pairs.set(
    creator,
    listitems.map(({ did }) => did),
  )
  return await ctx.hydrator.hydrateBidirectionalBlocks(pairs)
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
