import { Struct, Timestamp } from '@bufbuild/protobuf'
import * as MurmurhashModule from 'murmurhash'
const Murmurhash = ((m) => m.default ?? m)(MurmurhashModule)
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { MARK_READ_GENERIC } from './constants.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const viewer = auth.credentials.iss
      // @NOTE a future seenAt would mark new notifications as read until that
      // time, and the stored value never moves back.
      const seenAt = new Date(
        Math.min(new Date(input.body.seenAt).getTime(), Date.now()),
      )
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
              collapseKey: MARK_READ_GENERIC,
              timestamp: Timestamp.fromDate(new Date()),
              additional: Struct.fromJson({
                reason: MARK_READ_GENERIC,
              }),
            },
          ],
        }),
      ])
    },
  })
}

function getNotifId(viewer: string, seenAt: Date) {
  const key = [MARK_READ_GENERIC, viewer, seenAt.getTime().toString()].join(
    '::',
  )

  return Murmurhash.v3(key).toString(16)
}
