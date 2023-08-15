import { INVALID_HANDLE } from '@atproto/identifier'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.account(ctx.db).getAccount(did)

      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }

      const handleToDid = await ctx.idResolver.handle.resolve(user.handle)
      const handle =
        did === handleToDid ? user.handle.toLowerCase() : INVALID_HANDLE

      return {
        encoding: 'application/json',
        body: { handle, did: user.did, email: user.email },
      }
    },
  })
}
