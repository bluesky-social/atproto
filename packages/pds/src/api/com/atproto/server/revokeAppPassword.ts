import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.revokeAppPassword({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const { name } = input.body

      await ctx.accountManager.revokeAppPassword(requester, name)
    },
  })
}
