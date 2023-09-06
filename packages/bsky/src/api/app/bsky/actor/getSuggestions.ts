import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { Actor } from '../../../../db/tables/actor'
import { notSoftDeletedClause } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/getSuggestions'
import { createPipeline } from '../../../../pipeline'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'

export default function (server: Server, ctx: AppContext) {
  const getSuggestions = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.actor.getSuggestions({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const viewer = auth.credentials.did

      const result = await getSuggestions(
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
  const { limit, cursor, viewer } = params
  const { ref } = db.db.dynamic
  let suggestionsQb = db.db
    .selectFrom('suggested_follow')
    .innerJoin('actor', 'actor.did', 'suggested_follow.did')
    .innerJoin('profile_agg', 'profile_agg.did', 'actor.did')
    .where(notSoftDeletedClause(ref('actor')))
    .where('suggested_follow.did', '!=', viewer ?? '')
    .whereNotExists((qb) =>
      qb
        .selectFrom('follow')
        .selectAll()
        .where('creator', '=', viewer ?? '')
        .whereRef('subjectDid', '=', ref('actor.did')),
    )
    .selectAll()
    .select('profile_agg.postsCount as postsCount')
    .limit(limit)
    .orderBy('suggested_follow.order', 'asc')

  if (cursor) {
    const cursorRow = await db.db
      .selectFrom('suggested_follow')
      .where('did', '=', cursor)
      .selectAll()
      .executeTakeFirst()
    if (cursorRow) {
      suggestionsQb = suggestionsQb.where(
        'suggested_follow.order',
        '>',
        cursorRow.order,
      )
    }
  }
  const suggestions = await suggestionsQb.execute()
  return { params, suggestions, cursor: suggestions.at(-1)?.did }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService } = ctx
  const { params, suggestions } = state
  const { viewer } = params
  const [actors, bam] = await Promise.all([
    actorService.views.profiles(suggestions, viewer),
    graphService.getBlockAndMuteState(
      viewer ? suggestions.map((sug) => [viewer, sug.did]) : [],
    ),
  ])
  return { ...state, bam, actors }
}

const noBlocksOrMutes = (state: HydrationState) => {
  const { viewer } = state.params
  if (!viewer) return state
  state.suggestions = state.suggestions.filter(
    (item) =>
      !state.bam.block([viewer, item.did]) &&
      !state.bam.mute([viewer, item.did]),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { suggestions, actors, cursor } = state
  const suggestedActors = mapDefined(suggestions, (sug) => actors[sug.did])
  return { actors: suggestedActors, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = { params: Params; suggestions: Actor[]; cursor?: string }

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
}
