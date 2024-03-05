import assert from 'node:assert'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.sendEmail({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ input, auth }) => {
      if (auth.credentials.type === 'role' && !auth.credentials.moderator) {
        throw new AuthRequiredError('Insufficient privileges')
      }

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
        assert(ctx.cfg.entryway)
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.admin.sendEmail(input.body, {
            encoding: 'application/json',
            ...(await ctx.serviceAuthHeaders(
              recipientDid,
              ctx.cfg.entryway?.did,
            )),
          }),
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
