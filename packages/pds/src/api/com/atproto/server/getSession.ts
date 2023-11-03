import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const [user, didDoc] = await Promise.all([
        ctx.services.account(ctx.db).getAccount(did),
        didDocForSession(ctx, did),
      ])
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      return {
        encoding: 'application/json',
        body: {
          handle: user.handle,
          did: user.did,
          didDoc,
          email: user.email,
          emailConfirmed: !!user.emailConfirmedAt,
        },
      }
    },
  })
}
