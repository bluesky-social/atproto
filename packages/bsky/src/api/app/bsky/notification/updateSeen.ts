import { Struct, Timestamp } from '@bufbuild/protobuf'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { seenAt } = input.body
      const viewer = auth.credentials.iss
      await ctx.dataplane.updateNotificationSeen({
        actorDid: viewer,
        timestamp: Timestamp.fromDate(new Date(seenAt)),
      })
      await ctx.courierClient.pushNotifications({
        notifications: [
          {
            id: `${viewer}-${seenAt}`,
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
