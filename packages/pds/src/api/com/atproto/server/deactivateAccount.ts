import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deactivateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, input, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.deactivateAccount(
          input.body,
          authPassthru(req, true),
        )
        return
      }

      const requester = auth.credentials.did
      await ctx.accountManager.deactivateAccount(
        requester,
        input.body.deleteAfter ?? null,
      )
    },
  })
}
