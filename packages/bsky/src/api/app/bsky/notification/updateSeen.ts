import { Struct, Timestamp } from '@bufbuild/protobuf'
// eslint-disable-next-line import/no-named-as-default-member
import murmur from 'murmurhash'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const viewer = auth.credentials.iss
      const seenAt = new Date(input.body.seenAt)
      // For now we keep separate seen times behind the scenes for priority, but treat them as a single seen time.
      await Promise.all([
        ctx.dataplane.updateNotificationSeen({
          actorDid: viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: false,
        }),
        ctx.dataplane.updateNotificationSeen({
          actorDid: viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: true,
        }),
        ctx.courierClient?.pushNotifications({
          notifications: [
            {
              id: getNotifId(viewer, seenAt),
              clientControlled: true,
              recipientDid: viewer,
              alwaysDeliver: false,
              collapseKey: 'mark-read-generic',
              timestamp: Timestamp.fromDate(new Date()),
              additional: Struct.fromJson({
                reason: 'mark-read-generic',
              }),
            },
          ],
        }),
      ])
    },
  })
}

function getNotifId(viewer: string, seenAt: Date) {
  const key = ['mark-read-generic', viewer, seenAt.getTime().toString()].join(
    '::',
  )
  // eslint-disable-next-line import/no-named-as-default-member
  return murmur.v3(key).toString(16)
}
