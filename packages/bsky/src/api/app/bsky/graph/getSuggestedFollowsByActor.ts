import { sql } from 'kysely'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../../../../db'
import { ActorService } from '../../../../services/actor'

const RESULT_LENGTH = 10

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const viewer = auth.credentials.iss

      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const actorDid = await actorService.getActorDid(actor)

      if (!actorDid) {
        throw new InvalidRequestError('Actor not found')
      }

      const skeleton = await getSkeleton(
        {
          actor: actorDid,
          viewer,
        },
        {
          db,
          actorService,
        },
      )
      const hydrationState = await actorService.views.profileDetailHydration(
        skeleton.map((a) => a.did),
        { viewer },
      )
      const presentationState = actorService.views.profileDetailPresentation(
        skeleton.map((a) => a.did),
        hydrationState,
        { viewer },
      )
      const suggestions = Object.values(presentationState).filter((profile) => {
        return (
          !profile.viewer?.muted &&
          !profile.viewer?.mutedByList &&
          !profile.viewer?.blocking &&
          !profile.viewer?.blockedBy
        )
      })

      return {
        encoding: 'application/json',
        body: { suggestions },
      }
    },
  })
}

async function getSkeleton(
  params: {
    actor: string
    viewer: string
  },
  ctx: {
    db: Database
    actorService: ActorService
  },
): Promise<{ did: string }[]> {
  const actorsViewerFollows = ctx.db.db
    .selectFrom('follow')
    .where('creator', '=', params.viewer)
    .select('subjectDid')
  const mostLikedAccounts = await ctx.db.db
    .selectFrom(
      ctx.db.db
        .selectFrom('like')
        .where('creator', '=', params.actor)
        .select(sql`split_part(subject, '/', 3)`.as('subjectDid'))
        .orderBy('sortAt', 'desc')
        .limit(1000) // limit to 1000
        .as('likes'),
    )
    .select('likes.subjectDid as did')
    .select((qb) => qb.fn.count('likes.subjectDid').as('count'))
    .where('likes.subjectDid', 'not in', actorsViewerFollows)
    .where('likes.subjectDid', 'not in', [params.actor, params.viewer])
    .groupBy('likes.subjectDid')
    .orderBy('count', 'desc')
    .limit(RESULT_LENGTH)
    .execute()
  const resultDids = mostLikedAccounts.map((a) => ({ did: a.did })) as {
    did: string
  }[]

  if (resultDids.length < RESULT_LENGTH) {
    // backfill with popular accounts followed by actor
    const mostPopularAccountsActorFollows = await ctx.db.db
      .selectFrom('follow')
      .innerJoin('profile_agg', 'follow.subjectDid', 'profile_agg.did')
      .select('follow.subjectDid as did')
      .where('follow.creator', '=', params.actor)
      .where('follow.subjectDid', '!=', params.viewer)
      .where('follow.subjectDid', 'not in', actorsViewerFollows)
      .if(resultDids.length > 0, (qb) =>
        qb.where(
          'subjectDid',
          'not in',
          resultDids.map((a) => a.did),
        ),
      )
      .orderBy('profile_agg.followersCount', 'desc')
      .limit(RESULT_LENGTH)
      .execute()

    resultDids.push(...mostPopularAccountsActorFollows)
  }

  if (resultDids.length < RESULT_LENGTH) {
    // backfill with suggested_follow table
    const additional = await ctx.db.db
      .selectFrom('suggested_follow')
      .where(
        'did',
        'not in',
        // exclude any we already have
        resultDids.map((a) => a.did).concat([params.actor, params.viewer]),
      )
      // and aren't already followed by viewer
      .where('did', 'not in', actorsViewerFollows)
      .selectAll()
      .execute()

    resultDids.push(...additional)
  }

  return resultDids
}
