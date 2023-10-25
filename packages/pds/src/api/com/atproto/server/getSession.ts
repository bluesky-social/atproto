import { InvalidRequestError } from '@atproto/xrpc-server'
import { INVALID_HANDLE } from '@atproto/syntax'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.accountManager.getAccount(did)
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      return {
        encoding: 'application/json',
        body: {
          handle: user.handle ?? INVALID_HANDLE,
          did: user.did,
          email: user.email,
          emailConfirmed: !!user.emailConfirmedAt,
        },
      }
    },
  })
}
