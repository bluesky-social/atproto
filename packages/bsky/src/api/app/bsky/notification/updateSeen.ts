import { Struct, Timestamp } from '@bufbuild/protobuf'
import * as MurmurhashModule from 'murmurhash'
const Murmurhash = ((m) => m.default ?? m)(MurmurhashModule)
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const viewer = auth.credentials.iss
      const seenAt = new Date(input.body.seenAt)
      const timestamp = Timestamp.fromDate(seenAt)
      await Promise.all([
        ctx.bsyncClient.fanoutNotificationSeen({ actorDid: viewer, timestamp }),
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

  return Murmurhash.v3(key).toString(16)
}
