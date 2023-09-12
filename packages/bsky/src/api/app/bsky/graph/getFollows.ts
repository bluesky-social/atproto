import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getFollows'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { notSoftDeletedClause } from '../../../../db/util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { Actor } from '../../../../db/tables/actor'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getFollows = createPipeline(
    skeleton,
    hydration,
    noBlocksInclInvalid,
    presentation,
  )
  server.app.bsky.graph.getFollows({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const viewer = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage

      const result = await getFollows(
        { ...params, viewer, canViewTakendownProfile },
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
  const { db, actorService } = ctx
  const { limit, cursor, actor, canViewTakendownProfile } = params
  const { ref } = db.db.dynamic

  const creator = await actorService.getActor(actor, canViewTakendownProfile)
  if (!creator) {
    throw new InvalidRequestError(`Actor not found: ${actor}`)
  }

  let followsReq = db.db
    .selectFrom('follow')
    .where('follow.creator', '=', creator.did)
    .innerJoin('actor as subject', 'subject.did', 'follow.subjectDid')
    .if(!canViewTakendownProfile, (qb) =>
      qb.where(notSoftDeletedClause(ref('subject'))),
    )
    .selectAll('subject')
    .select(['follow.cid as cid', 'follow.sortAt as sortAt'])

  const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
  followsReq = paginate(followsReq, {
    limit,
    cursor,
    keyset,
  })

  const follows = await followsReq.execute()

  return {
    params,
    follows,
    creator,
    cursor: keyset.packFromResult(follows),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService } = ctx
  const { params, follows, creator } = state
  const { viewer } = params
  const [actors, bam] = await Promise.all([
    actorService.views.profiles([creator, ...follows], viewer),
    graphService.getBlockAndMuteState(
      follows.flatMap((item) => {
        if (viewer) {
          return [
            [viewer, item.did],
            [creator.did, item.did],
          ]
        }
        return [[creator.did, item.did]]
      }),
    ),
  ])
  return { ...state, bam, actors }
}

const noBlocksInclInvalid = (state: HydrationState) => {
  const { creator } = state
  const { viewer } = state.params
  state.follows = state.follows.filter(
    (item) =>
      !state.bam.block([creator.did, item.did]) &&
      (!viewer || !state.bam.block([viewer, item.did])),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { params, follows, creator, actors, cursor } = state
  const creatorView = actors[creator.did]
  const followsView = mapDefined(follows, (item) => actors[item.did])
  if (!creatorView) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }
  return { follows: followsView, subject: creatorView, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & {
  viewer: string | null
  canViewTakendownProfile: boolean
}

type SkeletonState = {
  params: Params
  follows: Actor[]
  creator: Actor
  cursor?: string
}

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
}
