import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

const MAX_RESULTS_LENGTH = 10
const LIKES_THRESHOLD = 50

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

      const likes = await db.db
        .selectFrom('like')
        .select(['subject', 'creator'])
        .where('creator', '=', actorDid)
        .limit(1000)
        .execute()

      let suggestions: Awaited<
        ReturnType<typeof actorService.views.hydrateProfiles>
      > = []
      let allActors: any[] = []

      const viewerFollows = db.db
        .selectFrom('follow')
        .where('creator', '=', viewer)
        .select('subjectDid')

      if (likes.length >= LIKES_THRESHOLD) {
        // get posts to get their authors
        const posts = await db.db
          .selectFrom('post')
          .where(
            'post.uri',
            'in',
            likes.map((l) => l.subject),
          )
          .select(['creator', 'uri'])
          .execute()

        const authorDIDs = Object.values(posts).map((p) => p.creator)
        const authorDIDsExcludingActorAndViewer = authorDIDs.filter(
          (did) => did !== actorDid && did !== viewer,
        )

        const authorsMappedByMostCommon =
          authorDIDsExcludingActorAndViewer.reduce((acc, did) => {
            acc[did] = (acc[did] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        const authorsSortedByMostCommon = Object.entries(
          authorsMappedByMostCommon,
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20) // take top 20 most common

        // get the profiles of the authors
        const authors = await db.db
          .selectFrom('actor')
          .where(
            'actor.did',
            'in',
            authorsSortedByMostCommon.map((a) => a[0]),
          )
          .selectAll()
          .execute()
        const sortedAuthors = authorsSortedByMostCommon
          .map(([did]) => authors.find((a) => a.did === did))
          .filter(Boolean) as typeof authors

        allActors = sortedAuthors
      } else {
        const popularFollows = await db.db
          .selectFrom('actor')
          .selectAll()
          .innerJoin(
            db.db
              .selectFrom('profile_agg')
              .select(['did', 'followersCount'])
              .innerJoin(
                db.db
                  .selectFrom('follow')
                  .selectAll()
                  .where('creator', '=', actorDid)
                  .where('subjectDid', '!=', viewer)
                  .where('subjectDid', 'not in', viewerFollows)
                  .as('follows'),
                'follows.subjectDid',
                'profile_agg.did',
              )
              .orderBy('followersCount', 'desc')
              .limit(20)
              .as('popularFollows'),
            'actor.did',
            'popularFollows.did',
          )
          .orderBy('popularFollows.followersCount', 'desc')
          .execute()

        allActors = popularFollows
      }

      if (allActors.length < MAX_RESULTS_LENGTH) {
        // backfill with suggested_follow table
        const additional = await db.db
          .selectFrom('actor')
          .innerJoin('suggested_follow', 'actor.did', 'suggested_follow.did')
          .where(
            'actor.did',
            'not in',
            // exclude any we already have
            allActors.map((a) => a.did).concat([actorDid, viewer]),
          )
          // and aren't already followed by viewer
          .where('actor.did', 'not in', viewerFollows)
          .selectAll()
          .execute()

        allActors.push(...additional)
      }

      // this handles blocks/mutes etc
      suggestions = (
        await actorService.views.hydrateProfiles(allActors, viewer)
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
