import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateAccountEmail, {
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input: { body }, req }) => {
      const account = await ctx.accountManager.getAccount(body.account, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError(`Account does not exist: ${body.account}`)
      }

      if (ctx.entrywayClient) {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await ctx.entrywayClient.xrpc(com.atproto.admin.updateAccountEmail, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
          body,
        })
        return
      }

      await ctx.accountManager.updateEmail({
        did: account.did,
        email: body.email,
      })
    },
  })
}
