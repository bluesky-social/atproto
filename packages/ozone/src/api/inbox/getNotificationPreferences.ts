import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
import { getNotificationPreferences } from '../../inbox/preferences.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getNotificationPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      return {
        encoding: 'application/json',
        body: {
          preferences: await getNotificationPreferences(
            ctx.db,
            inboxViewerDid(auth, params.did),
          ),
        },
      }
    },
  })
}
