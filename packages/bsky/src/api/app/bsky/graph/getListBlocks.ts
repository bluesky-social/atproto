import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getListBlocks'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { Actor } from '../../../../db/tables/actor'
import { GraphService, ListInfo } from '../../../../services/graph'
import { ActorService, ProfileHydrationState } from '../../../../services/actor'
import { createPipeline, noRules } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getListBlocks = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.graph.getListBlocks({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const graphService = ctx.services.graph(db)
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.did

      const result = await getListBlocks(
        { ...params, viewer },
        { db, actorService, graphService },
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
  const { limit, cursor, viewer } = params
  const { ref } = db.db.dynamic

  let listsReq = graphService
    .getListsQb(viewer)
    .whereExists(
      db.db
        .selectFrom('list_block')
        .where('list_block.creator', '=', viewer)
        .whereRef('list_block.subjectUri', '=', ref('list.uri'))
        .selectAll(),
    )

  const keyset = new TimeCidKeyset(ref('list.createdAt'), ref('list.cid'))

  listsReq = paginate(listsReq, {
    limit,
    cursor,
    keyset,
  })

  const listInfos = await listsReq.execute()

  return {
    params,
    listInfos,
    cursor: keyset.packFromResult(listInfos),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const { params, listInfos } = state
  const profileState = await actorService.views.profileHydration(
    listInfos.map((list) => list.creator),
    { viewer: params.viewer },
  )
  return { ...state, ...profileState }
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { actorService, graphService } = ctx
  const { params, listInfos, cursor, ...profileState } = state
  const actors = actorService.views.profilePresentation(
    Object.keys(profileState.profiles),
    profileState,
    { viewer: params.viewer },
  )
  const lists = listInfos.map((list) =>
    graphService.formatListView(list, actors),
  )
  return { lists, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  params: Params
  listInfos: (Actor & ListInfo)[]
  cursor?: string
}

type HydrationState = SkeletonState & ProfileHydrationState
