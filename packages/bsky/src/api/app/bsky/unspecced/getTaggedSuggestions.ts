import { UriString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getTaggedSuggestions, {
    handler: async () => {
      const res = await ctx.dataplane.getSuggestedEntities({})
      const suggestions = res.entities.map(
        (entity): app.bsky.unspecced.getTaggedSuggestions.Suggestion => ({
          tag: entity.tag,
          subjectType: entity.subjectType,
          subject: entity.subject as UriString,
        }),
      )

      return {
        encoding: 'application/json',
        body: {
          suggestions,
        },
      }
    },
  })
}
