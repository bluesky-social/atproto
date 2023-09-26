import { sql } from 'kysely'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanQuery,
  getUserSearchQuery,
  SearchKeyset,
} from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActors({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { cursor, limit } = params
      const requester = auth.credentials.did
      const rawQuery = params.q ?? params.term
      const query = cleanQuery(rawQuery || '')
      const db = ctx.db.getReplica('search')

      let results: string[]
      let resCursor: string | undefined
      if (ctx.searchAgent) {
        const res =
          await ctx.searchAgent.api.app.bsky.unspecced.searchActorsSkeleton({
            q: query,
            cursor,
            limit,
          })
        results = res.data.actors.map((a) => a.did)
        resCursor = res.data.cursor
      } else {
        const res = query
          ? await getUserSearchQuery(db, { query, limit, cursor })
              .select('distance')
              .selectAll('actor')
              .execute()
          : []
        results = res.map((a) => a.did)
        const keyset = new SearchKeyset(sql``, sql``)
        resCursor = keyset.packFromResult(res)
      }

      const actors = await ctx.services
        .actor(db)
        .views.profiles(results, requester)

      const SKIP = []
      const filtered = results.flatMap((did) => {
        const actor = actors[did]
        if (actor.viewer?.blocking || actor.viewer?.blockedBy) return SKIP
        return actor
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: resCursor,
          actors: filtered,
        },
      }
    },
  })
}
