import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActorList({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const viewer = auth.credentials.did
      await ctx.dataplane.muteActorList({ actorDid: viewer, listUri: list })
    },
  })
}
