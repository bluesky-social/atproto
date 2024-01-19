import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.emitModerationEvent({
    auth: ctx.authVerifier.access,
    handler: async ({ req, input, auth }) => {
      const { data: result } =
        await ctx.moderationAgent.com.atproto.admin.emitModerationEvent(
          input.body,
          {
            ...(await ctx.moderationAuthHeaders(auth.credentials.did, req)),
            encoding: 'application/json',
          },
        )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
