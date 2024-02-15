import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertValidDidDocumentForService } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.activateAccount({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did

      await assertValidDidDocumentForService(ctx, requester)

      await ctx.accountManager.activateAccount(requester)
    },
  })
}
