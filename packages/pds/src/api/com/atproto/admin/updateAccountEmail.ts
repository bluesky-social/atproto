import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountEmail({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      const account = await ctx.accountManager.getAccount(input.body.account, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError(
          `Account does not exist: ${input.body.account}`,
        )
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.admin.updateAccountEmail(
          input.body,
          authPassthru(req, true),
        )
        return
      }

      await ctx.accountManager.updateEmail({
        did: account.did,
        email: input.body.email,
      })
    },
  })
}
