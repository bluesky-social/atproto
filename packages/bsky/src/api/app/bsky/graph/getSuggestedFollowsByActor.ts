import { sql } from 'kysely'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

const MAX_RESULTS_LENGTH = 10
const RESULT_OVERFETCH = 20

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
      const mostLikedAccounts = await db.db
        .selectFrom(
          db.db
            .selectFrom('like')
            .where('creator', '=', actorDid)
            .select(sql`split_part(subject, '/', 3)`.as('subjectDid'))
            .limit(1000) // limit to 1000
            .as('likes'),
        )
        .select('likes.subjectDid as did')
        .select((qb) => qb.fn.count('likes.subjectDid').as('count'))
        .where('likes.subjectDid', 'not in', actorsViewerFollows)
        .where('likes.subjectDid', 'not in', [actorDid, viewer])
        .groupBy('likes.subjectDid')
        .orderBy('count', 'desc')
        .limit(RESULT_OVERFETCH)
        .execute()
      const resultDids = mostLikedAccounts.map((a) => ({ did: a.did })) as {
        did: string
      }[]

      if (resultDids.length < MAX_RESULTS_LENGTH) {
        // backfill with popular accounts followed by actor
        const mostPopularAccountsActorFollows = await db.db
          .selectFrom('follow')
          .innerJoin('profile_agg', 'follow.subjectDid', 'profile_agg.did')
          .select('follow.subjectDid as did')
          .where('follow.creator', '=', actorDid)
          .where('follow.subjectDid', '!=', viewer)
          .where('follow.subjectDid', 'not in', actorsViewerFollows)
          .if(resultDids.length > 0, (qb) =>
            qb.where(
              'subjectDid',
              'not in',
              resultDids.map((a) => a.did),
            ),
          )
          .orderBy('profile_agg.followersCount', 'desc')
          .limit(RESULT_OVERFETCH)
          .execute()

        resultDids.push(...mostPopularAccountsActorFollows)
      }

      if (resultDids.length < MAX_RESULTS_LENGTH) {
        // backfill with suggested_follow table
        const additional = await db.db
          .selectFrom('suggested_follow')
          .where(
            'did',
            'not in',
            // exclude any we already have
            resultDids.map((a) => a.did).concat([actorDid, viewer]),
          )
          // and aren't already followed by viewer
          .where('did', 'not in', actorsViewerFollows)
          .selectAll()
          .execute()

        resultDids.push(...additional)
      }

      const actors = await db.db
        .selectFrom('actor')
        .selectAll()
        .where(
          'did',
          'in',
          resultDids.map((a) => a.did),
        )
        .limit(RESULT_OVERFETCH)
        .execute()

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
