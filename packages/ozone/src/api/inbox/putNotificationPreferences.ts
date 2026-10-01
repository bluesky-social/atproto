import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { putNotificationPreferences } from '../../inbox/preferences.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.putNotificationPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      return {
        encoding: 'application/json',
        body: {
          preferences: await putNotificationPreferences(
            ctx.db,
            auth.credentials.iss,
            input.body,
          ),
        },
      }
    },
  })
}
