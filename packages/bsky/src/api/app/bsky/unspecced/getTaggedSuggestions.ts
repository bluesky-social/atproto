import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTaggedSuggestions({
    handler: async () => {
      const suggestions = await ctx.db
        .getReplica()
        .db.selectFrom('tagged_suggestion')
        .selectAll()
        .execute()
      return {
        encoding: 'application/json',
        body: {
          suggestions,
        },
      }
    },
  })
}
