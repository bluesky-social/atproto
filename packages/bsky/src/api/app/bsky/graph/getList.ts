import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getList'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { Actor } from '../../../../db/tables/actor'
import { GraphService, ListInfo } from '../../../../services/graph'
import { ActorService, ProfileHydrationState } from '../../../../services/actor'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getList = createPipeline(skeleton, hydration, noRules, presentation)
  server.app.bsky.graph.getList({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const graphService = ctx.services.graph(db)
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.did

      const result = await getList(
        { ...params, viewer },
        { db, graphService, actorService },
      )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { db, graphService } = ctx
  const { list, limit, cursor, viewer } = params
  const { ref } = db.db.dynamic

  const listRes = await graphService
    .getListsQb(viewer)
    .where('list.uri', '=', list)
    .executeTakeFirst()
  if (!listRes) {
    throw new InvalidRequestError(`List not found: ${list}`)
  }

  let itemsReq = graphService
    .getListItemsQb()
    .where('list_item.listUri', '=', list)
    .where('list_item.creator', '=', listRes.creator)

  const keyset = new TimeCidKeyset(
    ref('list_item.sortAt'),
    ref('list_item.cid'),
  )

  itemsReq = paginate(itemsReq, {
    limit,
    cursor,
    keyset,
  })

  const listItems = await itemsReq.execute()

  return {
    params,
    list: listRes,
    listItems,
    cursor: keyset.packFromResult(listItems),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const { params, list, listItems } = state
  const profileState = await actorService.views.profileHydration(
    [list, ...listItems].map((x) => x.did),
    { viewer: params.viewer },
  )
  return { ...state, ...profileState }
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { actorService, graphService } = ctx
  const { params, list, listItems, cursor, ...profileState } = state
  const actors = actorService.views.profilePresentation(
    Object.keys(profileState.profiles),
    profileState,
    { viewer: params.viewer },
  )
  const creator = actors[list.creator]
  if (!creator) {
    throw new InvalidRequestError(`Actor not found: ${list.handle}`)
  }
  const listView = graphService.formatListView(list, actors)
  const items = mapDefined(listItems, (item) => {
    const subject = actors[item.did]
    if (!subject) return
    return { subject }
  })
  return { list: listView, items, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & {
  viewer: string | null
}

type SkeletonState = {
  params: Params
  list: Actor & ListInfo
  listItems: (Actor & { cid: string; sortAt: string })[]
  cursor?: string
}

type HydrationState = SkeletonState & ProfileHydrationState
