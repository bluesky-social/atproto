import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const feed = ctx.services.feed(db)
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
        // this could pull less data
        const posts = await feed.getPostInfos(
          likes.map((l) => l.subject),
          viewer,
        )
        const authorDIDs = Object.values(posts)
          .map((p) => p.creator)
          .filter((did) => did !== actorDid && did !== viewer)
        const authorsMappedByMostCommon = authorDIDs.reduce((acc, did) => {
          acc[did] = (acc[did] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const authorsSortedByMostCommon = Object.entries(
          authorsMappedByMostCommon,
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20) // take top 20 most common
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

        suggestions = (
          await actorService.views.hydrateProfiles(sortedAuthors, viewer)
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
          suggestions,
        },
      }
    },
  })
}
