import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { listInboxNotifications } from '../../inbox/notifications.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.listNotifications, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => ({
      encoding: 'application/json',
      body: await listInboxNotifications(ctx.db, auth.credentials.iss, params),
    }),
  })
}
