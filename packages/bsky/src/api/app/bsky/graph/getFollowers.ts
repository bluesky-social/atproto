import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/graph/getFollowers'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { notSoftDeletedClause } from '../../../../db/util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { Actor } from '../../../../db/tables/actor'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getFollowers = createPipeline(
    skeleton,
    hydration,
    noBlocksInclInvalid,
    presentation,
  )
  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const { viewer, canViewTakedowns } = ctx.authVerifier.parseCreds(auth)

      const result = await getFollowers(
        { ...params, viewer, canViewTakedowns },
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
  const { limit, cursor, actor, canViewTakedowns } = params
  const { ref } = db.db.dynamic

  const subject = await actorService.getActor(actor, canViewTakedowns)
  if (!subject) {
    throw new InvalidRequestError(`Actor not found: ${actor}`)
  }

  if (TimeCidKeyset.clearlyBad(cursor)) {
    return { params, followers: [], subject }
  }

  let followersReq = db.db
    .selectFrom('follow')
    .where('follow.subjectDid', '=', subject.did)
    .innerJoin('actor as creator', 'creator.did', 'follow.creator')
    .if(!canViewTakedowns, (qb) =>
      qb.where(notSoftDeletedClause(ref('creator'))),
    )
    .selectAll('creator')
    .select(['follow.cid as cid', 'follow.sortAt as sortAt'])

  const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
  followersReq = paginate(followersReq, {
    limit,
    cursor,
    keyset,
  })

  const followers = await followersReq.execute()
  return {
    params,
    followers,
    subject,
    cursor: keyset.packFromResult(followers),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService } = ctx
  const { params, followers, subject } = state
  const { viewer } = params
  const [actors, bam] = await Promise.all([
    actorService.views.profiles([subject, ...followers], viewer),
    graphService.getBlockAndMuteState(
      followers.flatMap((item) => {
        if (viewer) {
          return [
            [viewer, item.did],
            [subject.did, item.did],
          ]
        }
        return [[subject.did, item.did]]
      }),
    ),
  ])
  return { ...state, bam, actors }
}

const noBlocksInclInvalid = (state: HydrationState) => {
  const { subject } = state
  const { viewer } = state.params
  state.followers = state.followers.filter(
    (item) =>
      !state.bam.block([subject.did, item.did]) &&
      (!viewer || !state.bam.block([viewer, item.did])),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { params, followers, subject, actors, cursor } = state
  const subjectView = actors[subject.did]
  const followersView = mapDefined(followers, (item) => actors[item.did])
  if (!subjectView) {
    throw new InvalidRequestError(`Actor not found: ${params.actor}`)
  }
  return { followers: followersView, subject: subjectView, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
}

type Params = QueryParams & {
  viewer: string | null
  canViewTakedowns: boolean
}

type SkeletonState = {
  params: Params
  followers: Actor[]
  subject: Actor
  cursor?: string
}

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
}
