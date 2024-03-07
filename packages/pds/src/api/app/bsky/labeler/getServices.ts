import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.labeler.getServices({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, req }) => {
      const requester = auth.credentials.did
      return pipethrough(ctx, req, requester)
    },
  })
}
