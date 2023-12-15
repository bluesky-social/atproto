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
  const { viewer } = params
  const alreadyIncluded = parseCursor(params.cursor)
  const { ref } = db.db.dynamic
  const suggestions = await db.db
    .selectFrom('suggested_follow')
    .innerJoin('actor', 'actor.did', 'suggested_follow.did')
    .where(notSoftDeletedClause(ref('actor')))
    .where('suggested_follow.did', '!=', viewer ?? '')
    .whereNotExists((qb) =>
      qb
        .selectFrom('follow')
        .selectAll()
        .where('creator', '=', viewer ?? '')
        .whereRef('subjectDid', '=', ref('actor.did')),
    )
    .if(alreadyIncluded.length > 0, (qb) =>
      qb.where('suggested_follow.order', 'not in', alreadyIncluded),
    )
    .selectAll()
    .orderBy('suggested_follow.order', 'asc')
    .execute()

  // always include first two
  const firstTwo = suggestions.filter(
    (row) => row.order === 1 || row.order === 2,
  )
  const rest = suggestions.filter((row) => row.order !== 1 && row.order !== 2)
  const limited = firstTwo.concat(shuffle(rest)).slice(0, params.limit)

  // if the result set ends up getting larger, consider using a seed included in the cursor for for the randomized shuffle
  const cursor =
    limited.length > 0
      ? limited
          .map((row) => row.order.toString())
          .concat(alreadyIncluded.map((id) => id.toString()))
          .join(':')
      : undefined

  return { params, suggestions: limited, cursor }
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

const parseCursor = (cursor?: string): number[] => {
  if (!cursor) {
    return []
  }
  try {
    return cursor
      .split(':')
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id))
  } catch {
    return []
  }
}

const shuffle = <T>(arr: T[]): T[] => {
  return arr
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
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
