import { sql } from 'kysely';
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

const MAX_RESULTS_LENGTH = 10

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const actorDid = await actorService.getActorDid(actor)

      if (!actorDid) {
        throw new InvalidRequestError('Actor not found')
      }

      const actorsViewerFollows = db.db
        .selectFrom('follow')
        .where('creator', '=', viewer)
        .select('subjectDid')

      /**
       * 20 most liked accounts that aren't already followed by the viewer, ARE
       * the viewer, or are the actor
       */
      const mostLikedAccounts = db.db
        .selectFrom(
          db.db
            .selectFrom('like')
            .where('creator', '=', actorDid)
            .select(sql`split_part(subject, '/', 3)`.as('subjectDid'))
            .as('likes')
        )
        .select('likes.subjectDid as did')
        .select(qb => qb.fn.count('likes.subjectDid').as('count'))
        .where('likes.subjectDid', 'not in', actorsViewerFollows)
        .where('likes.subjectDid', 'not in', [actorDid, viewer])
        .groupBy('likes.subjectDid')
        .orderBy('count', 'desc')
        .limit(20)

      /**
       * 20 most liked accounts as actor results
       */
      const actors = await db.db
        .selectFrom('actor')
        .selectAll()
        .innerJoin(mostLikedAccounts.as('liked'), 'actor.did', 'liked.did')
        .orderBy('liked.count', 'desc')
        .execute() // TODO should return max 20 right?

      if (actors.length < MAX_RESULTS_LENGTH) {
        // backfill with popular accounts followed by actor
        const actorsActorFollows = db.db
          .selectFrom('follow')
          .selectAll()
          .where('creator', '=', actorDid)
          .where('subjectDid', '!=', viewer)
          .where('subjectDid', 'not in', actorsViewerFollows)
          .if(
            actors.length > 0,
            qb => qb.where('subjectDid', 'not in', actors.map((a) => a.did))
          )
        const mostPopularAccountsActorFollows = db.db
          .selectFrom('profile_agg')
          .select(['did', 'followersCount'])
          .innerJoin(
            actorsActorFollows.as('follows'),
            'follows.subjectDid',
            'profile_agg.did',
          )
          .orderBy('followersCount', 'desc')
          .limit(20)
        const mostPopularActors = await db.db
          .selectFrom('actor')
          .selectAll()
          .innerJoin(
            mostPopularAccountsActorFollows.as('popularFollows'),
            'actor.did',
            'popularFollows.did',
          )
          .orderBy('popularFollows.followersCount', 'desc')
          .execute()

        actors.push(...mostPopularActors)
      }

      if (actors.length < MAX_RESULTS_LENGTH) {
        // backfill with suggested_follow table
        const additional = await db.db
          .selectFrom('actor')
          .innerJoin('suggested_follow', 'actor.did', 'suggested_follow.did')
          .where(
            'actor.did',
            'not in',
            // exclude any we already have
            actors.map((a) => a.did).concat([actorDid, viewer]),
          )
          // and aren't already followed by viewer
          .where('actor.did', 'not in', actorsViewerFollows)
          .selectAll()
          .execute()

        actors.push(...additional)
      }

      // resolve all profiles, this handles blocks/mutes etc
      const suggestions = (
        await actorService.views.hydrateProfiles(actors, viewer)
      ).filter((account) => {
        return (
          !account.viewer?.muted &&
          !account.viewer?.blocking &&
          !account.viewer?.blockedBy
        )
      })

      return {
        encoding: 'application/json',
        body: {
          suggestions: suggestions.slice(0, MAX_RESULTS_LENGTH),
        },
      }
    },
  })
}
