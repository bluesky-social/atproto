import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const viewer = auth.credentials.did
      await ctx.dataplane.muteActor({ actorDid: viewer, subjectDid: actor })
    },
  })
}
