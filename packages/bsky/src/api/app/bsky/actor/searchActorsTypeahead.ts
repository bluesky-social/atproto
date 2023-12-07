import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  cleanQuery,
  getUserSearchQuerySimple,
} from '../../../../services/util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { limit } = params
      const requester = auth.credentials.did
      const rawQuery = params.q ?? params.term
      const query = cleanQuery(rawQuery || '')
      const db = ctx.db.getReplica('search')

      let results: string[]
      if (ctx.searchAgent) {
        const res =
          await ctx.searchAgent.api.app.bsky.unspecced.searchActorsSkeleton({
            q: query,
            typeahead: true,
            limit,
          })
        results = res.data.actors.map((a) => a.did)
      } else {
        const res = query
          ? await getUserSearchQuerySimple(db, { query, limit })
              .selectAll('actor')
              .execute()
          : []
        results = res.map((a) => a.did)
      }

      const actors = await ctx.services
        .actor(db)
        .views.profilesBasic(results, requester)

      const SKIP = []
      const filtered = results.flatMap((did) => {
        const actor = actors[did]
        if (!actor) return SKIP
        if (actor.viewer?.blocking || actor.viewer?.blockedBy) return SKIP
        return actor
      })

      return {
        encoding: 'application/json',
        body: {
          actors: filtered,
        },
      }
    },
  })
}
