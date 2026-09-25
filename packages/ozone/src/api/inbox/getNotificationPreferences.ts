import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getNotificationPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const row = await ctx.db.db
        .selectFrom('inbox_notification_preference')
        .select('push')
        .where('did', '=', auth.credentials.iss)
        .executeTakeFirst()
      return {
        encoding: 'application/json',
        body: { preferences: { push: row?.push ?? true } },
      }
    },
  })
}
