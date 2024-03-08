import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethroughProcedure } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.access,
    handler: async ({ input, auth, req }) => {
      const requester = auth.credentials.did
      await pipethroughProcedure(ctx, req, input.body, requester)
    },
  })
}
