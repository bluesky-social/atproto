import { MethodNotImplementedError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { claimPushNotifications } from '../../inbox/push-outbox.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.claimPushNotifications, {
    auth: ctx.authVerifier.inboxPush,
    handler: async ({ input }) => {
      if (!ctx.cfg.inbox.pushEnabled) throw new MethodNotImplementedError()
      return {
        encoding: 'application/json',
        body: await claimPushNotifications(
          ctx.db,
          input.body.limit ?? 50,
          ctx.cfg.inbox.startAt,
        ),
      }
    },
  })
}
