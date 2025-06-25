import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTaggedSuggestions({
    handler: async () => {
      const res = await ctx.dataplane.getSuggestedEntities({})
      const suggestions = res.entities.map((entity) => ({
        tag: entity.tag,
        subjectType: entity.subjectType,
        subject: entity.subject,
      }))
      return {
        encoding: 'application/json',
        body: {
          suggestions,
        },
      }
    },
  })
}
