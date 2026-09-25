import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.putNotificationPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { push } = input.body
      await ctx.db.db
        .insertInto('inbox_notification_preference')
        .values({ did: auth.credentials.iss, push })
        .onConflict((oc) => oc.column('did').doUpdateSet({ push }))
        .execute()
      return { encoding: 'application/json', body: { preferences: { push } } }
    },
  })
}
