import { MethodNotImplementedError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { getNotificationPreferences } from '../../inbox/preferences.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getPushPreference, {
    auth: ctx.authVerifier.inboxPush,
    handler: async ({ params }) => {
      if (!ctx.cfg.inbox.pushEnabled) throw new MethodNotImplementedError()
      const preferences = await getNotificationPreferences(
        ctx.db,
        params.recipientDid,
      )
      return {
        encoding: 'application/json',
        body: { enabled: preferences[params.category] },
      }
    },
  })
}
