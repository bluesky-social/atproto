import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  countUnreadNotifications,
  inboxSection,
} from '../../inbox/notifications.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getUnreadCount, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = auth.credentials.iss
      if (params.section) {
        const section = inboxSection(params.section)
        const count = await countUnreadNotifications(ctx.db, did, section)
        const total = section === 'accountStatus' ? Math.min(count, 1) : count
        return {
          encoding: 'application/json',
          body: { unreadCounts: { total } },
        }
      }
      const [reports, subjects, accountStatus] = await Promise.all([
        countUnreadNotifications(ctx.db, did, 'reports'),
        countUnreadNotifications(ctx.db, did, 'subjects'),
        countUnreadNotifications(ctx.db, did, 'accountStatus'),
      ])
      return {
        encoding: 'application/json',
        body: {
          unreadCounts: {
            total: reports + subjects + Math.min(accountStatus, 1),
            reports,
            subjects,
            accountStatus: Math.min(accountStatus, 1),
          },
        },
      }
    },
  })
}
