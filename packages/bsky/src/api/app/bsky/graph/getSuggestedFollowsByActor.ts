import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getSuggestedFollowsByActor({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { actor } = params
      const viewer = auth.credentials.did

      return {
        encoding: 'application/json',
        body: {
          suggestions: [],
        },
      }
    },
  })
}
