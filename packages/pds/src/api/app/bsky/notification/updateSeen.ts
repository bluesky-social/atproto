import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.accessVerifier,
    handler: async ({ input, auth }) => {
      const { seenAt } = input.body
      const requester = auth.credentials.did

      let parsed: string
      try {
        parsed = new Date(seenAt).toISOString()
      } catch (_err) {
        throw new InvalidRequestError('Invalid date')
      }

      const user = await ctx.services.account(ctx.db).getAccount(requester)
      if (!user) {
        throw new InvalidRequestError(`Could not find user: ${requester}`)
      }

      await ctx.db.db
        .updateTable('user_state')
        .set({ lastSeenNotifs: parsed })
        .where('did', '=', user.did)
        .executeTakeFirst()
    },
  })
}
