import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.revokeAppPassword({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.revokeAppPassword(
          input.body,
          authPassthru(req, true),
        )
        return
      }

      const requester = auth.credentials.did
      const { name } = input.body

      await ctx.accountManager.revokeAppPassword(requester, name)
    },
  })
}
