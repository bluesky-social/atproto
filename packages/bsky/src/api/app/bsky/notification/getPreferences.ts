import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { getNotificationPreferences } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.getPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const actorDid = auth.credentials.iss
      const preferences = await getNotificationPreferences(ctx, actorDid)
      return {
        encoding: 'application/json',
        body: {
          preferences,
        },
      }
    },
  })
}
