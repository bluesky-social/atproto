import murmur from 'murmurhash'
import { Struct, Timestamp } from '@bufbuild/protobuf'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.standard,
    handler: ctx.createHandler(async (ctx) => {
      const seenAt = new Date(ctx.input.body.seenAt)

      // For now we keep separate seen times behind the scenes for priority, but treat them as a single seen time.
      await Promise.all([
        ctx.dataplane.updateNotificationSeen({
          actorDid: ctx.viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: false,
        }),
        ctx.dataplane.updateNotificationSeen({
          actorDid: ctx.viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: true,
        }),
        ctx.courierClient?.pushNotifications({
          notifications: [
            {
              id: getNotifId(ctx.viewer, seenAt),
              clientControlled: true,
              recipientDid: ctx.viewer,
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
    }),
  })
}

function getNotifId(viewer: string, seenAt: Date) {
  const key = ['mark-read-generic', viewer, seenAt.getTime().toString()].join(
    '::',
  )
  return murmur.v3(key).toString(16)
}
