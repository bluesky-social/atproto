import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateAccountEmail, {
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

      if (ctx.entrywayClient) {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await ctx.entrywayClient.xrpc(com.atproto.admin.updateAccountEmail, {
          headers,
          body: input.body,
        })
        return
      }

      await ctx.accountManager.updateEmail({
        did: account.did,
        email: input.body.email,
      })
    },
  })
}
