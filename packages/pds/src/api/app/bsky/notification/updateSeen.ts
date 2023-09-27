import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
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

      if (ctx.canProxyWrite()) {
        await ctx.appviewAgent.api.app.bsky.notification.updateSeen(
          input.body,
          {
            ...(await ctx.serviceAuthHeaders(requester)),
            encoding: 'application/json',
          },
        )
      }

      await ctx.db.db
        .updateTable('user_state')
        .set({ lastSeenNotifs: parsed })
        .where('did', '=', user.did)
        .executeTakeFirst()
    },
  })
}
