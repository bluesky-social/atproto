import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethroughProcedure } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActorList({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input, req }) => {
      const requester = auth.credentials.did
      await pipethroughProcedure(ctx, req, input.body, requester)
    },
  })
}
