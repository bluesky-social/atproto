import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getLikes'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { Actor } from '../../../../db/tables/actor'
import { Database } from '../../../../db'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getLikes = createPipeline(skeleton, hydration, noBlocks, presentation)
  server.app.bsky.feed.getLikes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const viewer = auth.credentials.iss

      const result = await getLikes(
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
  const { uri, cid, limit, cursor } = params
  const { ref } = db.db.dynamic

  let builder = db.db
    .selectFrom('like')
    .where('like.subject', '=', uri)
    .innerJoin('actor as creator', 'creator.did', 'like.creator')
    .where(notSoftDeletedClause(ref('creator')))
    .selectAll('creator')
    .select([
      'like.cid as cid',
      'like.createdAt as createdAt',
      'like.indexedAt as indexedAt',
      'like.sortAt as sortAt',
    ])

  if (cid) {
    builder = builder.where('like.subjectCid', '=', cid)
  }

  const keyset = new TimeCidKeyset(ref('like.sortAt'), ref('like.cid'))
  builder = paginate(builder, {
    limit,
    cursor,
    keyset,
  })

  const likes = await builder.execute()

  return { params, likes, cursor: keyset.packFromResult(likes) }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService } = ctx
  const { params, likes } = state
  const { viewer } = params
  const [actors, bam] = await Promise.all([
    actorService.views.profiles(likes, viewer),
    graphService.getBlockAndMuteState(
      viewer ? likes.map((like) => [viewer, like.did]) : [],
    ),
  ])
  return { ...state, bam, actors }
}

const noBlocks = (state: HydrationState) => {
  const { viewer } = state.params
  if (!viewer) return state
  state.likes = state.likes.filter(
    (item) => !state.bam.block([viewer, item.did]),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { params, likes, actors, cursor } = state
  const { uri, cid } = params
  const likesView = mapDefined(likes, (like) =>
    actors[like.did]
      ? {
          createdAt: like.createdAt,
          indexedAt: like.indexedAt,
          actor: actors[like.did],
        }
      : undefined,
  )
  return { likes: likesView, cursor, uri, cid }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  likes: (Actor & { createdAt: string })[]
  cursor?: string
}

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
}
