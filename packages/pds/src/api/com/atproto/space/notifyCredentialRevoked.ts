import { isDidString } from '@atproto/lex'
import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyCredentialRevoked, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, credentials } = input.body
      const { spaceDid } = toSpaceRef(space)
      if (auth.credentials.iss !== spaceDid) {
        throw new ForbiddenError('Revocation issuer is not the space authority')
      }
      const { aud } = auth.credentials
      const account = isDidString(aud)
        ? await ctx.accountManager.getAccount(aud, {
            includeDeactivated: true,
            includeTakenDown: true,
          })
        : null
      if (!account) {
        throw new ForbiddenError(
          'Revocation audience does not match a repo hosted here',
        )
      }

      await ctx.accountManager.addRevokedSpaceCredentials(space, credentials)
      ctx.backgroundQueue.add(async () => {
        await ctx.accountManager.deleteExpiredRevokedSpaceCredentials()
      })
    },
  })
}
