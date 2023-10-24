import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfo({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params, auth }) => {
      // any role auth can get account info, verfyy aud on service jwt
      if (
        auth.credentials.type === 'service' &&
        auth.credentials.aud !== params.did
      ) {
        throw new AuthRequiredError(
          'jwt audience does not match account did',
          'BadJwtAudience',
        )
      }
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
