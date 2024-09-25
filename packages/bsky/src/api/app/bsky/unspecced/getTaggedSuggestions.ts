import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTaggedSuggestions({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const { dataplane } = await ctx.createRequestContent({
        viewer,
        labelers,
      })

      const res = await dataplane.getSuggestedEntities({})
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
