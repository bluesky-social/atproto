import { Struct, Timestamp } from '@bufbuild/protobuf'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import murmur from 'murmurhash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { seenAt } = input.body
      const viewer = auth.credentials.iss
      const date = new Date(seenAt)
      await ctx.dataplane.updateNotificationSeen({
        actorDid: viewer,
        timestamp: Timestamp.fromDate(date),
      })
      await ctx.courierClient.pushNotifications({
        notifications: [
          {
            id: getNotifId(viewer, date),
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
      })
    },
  })
}

function getNotifId(viewer: string, seenAt: Date) {
  const key = ['mark-read-generic', viewer, seenAt.getTime().toString()].join(
    '::',
  )
  return murmur.v3(key).toString(16)
}
