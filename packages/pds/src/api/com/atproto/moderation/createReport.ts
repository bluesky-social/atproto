import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did
      const { data: result } =
        await ctx.appViewAgent.com.atproto.moderation.createReport(input.body, {
          ...(await ctx.serviceAuthHeaders(requester)),
          encoding: 'application/json',
        })
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
