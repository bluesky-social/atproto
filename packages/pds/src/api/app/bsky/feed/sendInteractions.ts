import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethroughProcedure } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.sendInteractions({
    auth: ctx.authVerifier.access,
    handler: async ({ input, auth, req }) => {
      const requester = auth.credentials.did
      return pipethroughProcedure(ctx, req, input.body, requester)
    },
  })
}
