import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getList'
import AppContext from '../../../../context'
import {
  createPipelineNew,
  HydrationFnInput,
  noRulesNew,
  PresentationFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import { Hydrator, mergeStates } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'

export default function (server: Server, ctx: AppContext) {
  const getList = createPipelineNew(
    skeleton,
    hydration,
    noRulesNew,
    presentation,
  )
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
  const { list, limit, cursor } = params
  // @TODO this should be an array of listitem uris rather than dids
  const listMembers = await ctx.hydrator.dataplane.getListMembers({
    listUri: list,
    limit,
    cursor,
  })
  return {
    listUri: list,
    listMembers: listMembers.dids, // TODO
    cursor: listMembers.cursor,
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, params, skeleton } = input
  const { viewer } = params
  const { listUri, listMembers } = skeleton
  const [listState, profileState] = await Promise.all([
    ctx.hydrator.hydrateLists([listUri], viewer),
    ctx.hydrator.hydrateProfiles(listMembers, viewer),
  ])
  return mergeStates(listState, profileState)
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { ctx, skeleton, hydration } = input
  const { listUri, listMembers, cursor } = skeleton
  const list = ctx.views.list(listUri, hydration)
  const profiles = mapDefined(listMembers, (did) =>
    ctx.views.profile(did, hydration),
  )
  if (!list) {
    throw new InvalidRequestError('List not found')
  }
  return {
    list,
    items: profiles.map((profile) => ({
      uri: `at://did:example:creator/app.bsky.graph.listitem/${profile.did}`, // @TODO need list item uri
      subject: profile,
    })),
    cursor,
  }
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
  listMembers: string[]
  cursor?: string
}
