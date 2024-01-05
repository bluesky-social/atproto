import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { Database } from '../../../../db'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'
import { Actor } from '../../../../db/tables/actor'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getRepostedBy = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const viewer = auth.credentials.iss

      const result = await getRepostedBy(
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
  const { db } = ctx
  const { limit, cursor, uri, cid } = params
  const { ref } = db.db.dynamic

  let builder = db.db
    .selectFrom('repost')
    .where('repost.subject', '=', uri)
    .innerJoin('actor as creator', 'creator.did', 'repost.creator')
    .where(notSoftDeletedClause(ref('creator')))
    .selectAll('creator')
    .select(['repost.cid as cid', 'repost.sortAt as sortAt'])

  if (cid) {
    builder = builder.where('repost.subjectCid', '=', cid)
  }

  const keyset = new TimeCidKeyset(ref('repost.sortAt'), ref('repost.cid'))
  builder = paginate(builder, {
    limit,
    cursor,
    keyset,
  })

  const repostedBy = await builder.execute()
  return { params, repostedBy, cursor: keyset.packFromResult(repostedBy) }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService } = ctx
  const { params, repostedBy } = state
  const { viewer } = params
  const [actors, bam] = await Promise.all([
    actorService.views.profiles(repostedBy, viewer),
    graphService.getBlockAndMuteState(
      viewer ? repostedBy.map((item) => [viewer, item.did]) : [],
    ),
  ])
  return { ...state, bam, actors }
}

const noBlocks = (state: HydrationState) => {
  const { viewer } = state.params
  if (!viewer) return state
  state.repostedBy = state.repostedBy.filter(
    (item) => !state.bam.block([viewer, item.did]),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { params, repostedBy, actors, cursor } = state
  const { uri, cid } = params
  const repostedByView = mapDefined(repostedBy, (item) => actors[item.did])
  return { repostedBy: repostedByView, cursor, uri, cid }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  repostedBy: Actor[]
  cursor?: string
}

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
}
