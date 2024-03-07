import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethroughProcedure } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ req, input, auth }) => {
      const requester = auth.credentials.did
      return pipethroughProcedure(ctx, req, input.body, requester)
    },
  })
}
