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
import { Hydrator, mergeStates } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getList = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getList({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.did
      const result = await getList({ ...params, viewer }, ctx)
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
  const { listitemUris, cursor } = await ctx.hydrator.dataplane.getListMembers({
    listUri: params.list,
    limit: params.limit,
    cursor: params.cursor,
  })
  return {
    listUri: params.list,
    listitemUris: listitemUris,
    cursor: cursor || undefined,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { listUri, listitemUris } = skeleton
  const [listState, listitemState] = await Promise.all([
    ctx.hydrator.hydrateLists([listUri], viewer),
    ctx.hydrator.hydrateListItems(listitemUris, viewer),
  ])
  return mergeStates(listState, listitemState)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUri, listitemUris, cursor } = skeleton
  const list = ctx.views.list(listUri, hydration)
  const items = mapDefined(listitemUris, (uri) => {
    const listitem = hydration.listItems?.get(uri)
    if (!listitem) return
    const subject = ctx.views.profile(listitem.record.subject, hydration)
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
  viewer: string | null
}

type SkeletonState = {
  listUri: string
  listitemUris: string[]
  cursor?: string
}
