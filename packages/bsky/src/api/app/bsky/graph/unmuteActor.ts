import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActor({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const viewer = auth.credentials.did
      await ctx.dataplane.unmuteActor({ actorDid: viewer, subjectDid: actor })
    },
  })
}
