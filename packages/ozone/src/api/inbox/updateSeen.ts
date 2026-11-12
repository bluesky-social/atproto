import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxSection } from '../../inbox/notifications.js'
import { updateSeenAt } from '../../inbox/seen.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const applied = await updateSeenAt(
        ctx.db,
        auth.credentials.iss,
        input.body.sections.map(inboxSection),
        input.body.seenAt,
      )
      return { encoding: 'application/json', body: { seenAt: applied } }
    },
  })
}
