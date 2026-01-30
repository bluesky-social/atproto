import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.sendEmail, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ input: { body }, req }) => {
      const { content, recipientDid, subject = 'Message via your PDS' } = body

      const account = await ctx.accountManager.getAccount(recipientDid, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('Recipient not found')
      }

      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          recipientDid,
          com.atproto.admin.sendEmail.$lxm,
        )

        return ctx.entrywayClient.xrpc(com.atproto.admin.sendEmail, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
          body,
        })
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }

      await ctx.moderationMailer.send(
        { content },
        { subject, to: account.email },
      )

      return {
        encoding: 'application/json' as const,
        body: { sent: true },
      }
    },
  })
}
