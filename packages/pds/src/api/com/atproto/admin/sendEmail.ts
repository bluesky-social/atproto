import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, resultPassthru } from '../../../proxy'

// @TODO this needs to be refactored to come from ozone

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.sendEmail({
    auth: ctx.authVerifier.moderator,
    handler: async ({ req, input }) => {
      const {
        content,
        recipientDid,
        senderDid,
        subject = 'Message from Bluesky moderator',
        comment,
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
            authPassthru(req, true),
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

      if (ctx.moderationAgent) {
        await ctx.moderationAgent.api.com.atproto.admin.emitModerationEvent(
          {
            event: {
              $type: 'com.atproto.admin.defs#modEventEmail',
              subjectLine: subject,
              comment,
            },
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: recipientDid,
            },
            createdBy: senderDid,
          },
          { ...authPassthru(req), encoding: 'application/json' },
        )
      }

      return {
        encoding: 'application/json',
        body: { sent: true },
      }
    },
  })
}
