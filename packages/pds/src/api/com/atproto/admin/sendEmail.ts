import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.sendEmail({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin && !auth.credentials.moderator) {
        throw new AuthRequiredError('Insufficient privileges')
      }

      const {
        content,
        recipientDid,
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
      return {
        encoding: 'application/json',
        body: { sent: true },
      }
    },
  })
}
