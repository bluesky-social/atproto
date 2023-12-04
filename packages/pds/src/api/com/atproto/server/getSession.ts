import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const [account, didDoc] = await Promise.all([
        ctx.services.account(ctx.db).getAccount(did),
        didDocForSession(ctx, {
          did,
          pdsDid: auth.credentials.audience ?? null,
        }),
      ])
      if (!account) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      return {
        encoding: 'application/json',
        body: {
          handle: account.handle,
          did: account.did,
          didDoc,
          email: account.email,
          emailConfirmed: !!account.emailConfirmedAt,
        },
      }
    },
  })
}
