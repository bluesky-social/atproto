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

      const likes = await db.db
        .selectFrom('like')
        .select(['subject', 'creator'])
        .where('creator', '=', actorDid)
        .limit(1000)
        .execute()

      let suggestions: Awaited<
        ReturnType<typeof actorService.views.hydrateProfiles>
      > = []

      if (likes.length >= 100) {
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

        const actors = sortedAuthors

        if (suggestions.length < MAX_RESULTS_LENGTH) {
          // backfill with suggested_follow table
          const additional = await db.db
            .selectFrom('actor')
            .innerJoin('suggested_follow', 'actor.did', 'suggested_follow.did')
            .where(
              'actor.did',
              'not in',
              // exclude any we already have
              authorDIDsExcludingActorAndViewer.concat([actorDid, viewer]),
            )
            .selectAll()
            .execute()

          actors.push(...additional)
        }

        // this handles blocks/mutes etc
        suggestions = (
          await actorService.views.hydrateProfiles(actors, viewer)
        ).filter((account) => {
          return (
            !account.viewer?.muted &&
            !account.viewer?.blocking &&
            !account.viewer?.blockedBy
          )
        })
      }

      return {
        encoding: 'application/json',
        body: {
          suggestions: suggestions.slice(0, MAX_RESULTS_LENGTH),
        },
      }
    },
  })
}
