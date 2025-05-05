import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountPassword({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.admin.updateAccountPassword(
          input.body,
          ctx.entrywayPassthruHeaders(req),
        )
        return
      }

      const { did, password } = input.body
      await ctx.accountManager.updateAccountPassword({ did, password })
    },
  })
}
