import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did
      if (!ctx.moderationAgent) {
        throw new InvalidRequestError(
          'Your hosting service is not configured with a moderation provider. Reach out to your hosting provider.',
        )
      }
      const { data: result } =
        await ctx.moderationAgent.com.atproto.moderation.createReport(
          input.body,
          {
            ...(await ctx.moderationAuthHeaders(requester)),
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
