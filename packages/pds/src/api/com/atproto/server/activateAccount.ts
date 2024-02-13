import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      // @TODO verify the did is setup & formatted correctly
      await ctx.accountManager.activateAccount(requester)
    },
  })
}
