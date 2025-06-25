import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.sendEmail({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input, req }) => {
      const {
        content,
        recipientDid,
        subject = 'Message via your PDS',
      } = input.body

      const account = await ctx.accountManager.getAccount(recipientDid, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('Recipient not found')
      }

      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.admin.sendEmail(
            input.body,
            await ctx.entrywayAuthHeaders(
              req,
              recipientDid,
              ids.ComAtprotoAdminSendEmail,
            ),
          ),
        )
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }

      await ctx.moderationMailer.send(
        { content },
        { subject, to: account.email },
      )

      return {
        encoding: 'application/json',
        body: { sent: true },
      }
    },
  })
}
