import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.sendEmail({
    auth: ctx.authVerifier.role,
    handler: async ({ req, input, auth }) => {
      if (!auth.credentials.admin && !auth.credentials.moderator) {
        throw new AuthRequiredError('Insufficient privileges')
      }

      const {
        content,
        recipientDid,
        senderDid,
        subject = 'Message from Bluesky moderator',
      } = input.body
      const userInfo = await ctx.db.db
        .selectFrom('user_account')
        .where('did', '=', recipientDid)
        .select('email')
        .executeTakeFirst()

      if (!userInfo) {
        throw new InvalidRequestError('Recipient not found')
      }

      await ctx.moderationMailer.send(
        { content },
        { subject, to: userInfo.email },
      )
      await ctx.appViewAgent.api.com.atproto.admin.emitModerationEvent(
        {
          event: {
            $type: 'com.atproto.admin.defs#modEventEmail',
            subjectLine: subject,
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: recipientDid,
          },
          createdBy: senderDid,
        },
        { ...authPassthru(req), encoding: 'application/json' },
      )
      return {
        encoding: 'application/json',
        body: { sent: true },
      }
    },
  })
}
