import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const { data: recordDetailAppview } =
        await ctx.moderationAgent.com.atproto.admin.getRecord(
          params,
          await ctx.moderationAuthHeaders(auth.credentials.did, req),
        )
      return {
        encoding: 'application/json',
        body: recordDetailAppview,
      }
    },
  })
}
