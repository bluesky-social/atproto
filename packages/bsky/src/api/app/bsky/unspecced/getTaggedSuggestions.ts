import type { UriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
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
