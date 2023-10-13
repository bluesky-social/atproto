import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfo({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params }) => {
      const view = await ctx.services.account(ctx.db).adminView(params.did)
      if (!view) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }
      return {
        encoding: 'application/json',
        body: view,
      }
    },
  })
}
