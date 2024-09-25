import { Timestamp } from '@bufbuild/protobuf'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.updateSeen({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth, req }) => {
      const viewer = auth.credentials.iss
      const seenAt = new Date(input.body.seenAt)
      const labelers = ctx.reqLabelers(req)

      const { dataplane } = await ctx.createRequestContent({
        viewer,
        labelers,
      })

      // For now we keep separate seen times behind the scenes for priority, but treat them as a single seen time.
      await Promise.all([
        dataplane.updateNotificationSeen({
          actorDid: viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: false,
        }),
        dataplane.updateNotificationSeen({
          actorDid: viewer,
          timestamp: Timestamp.fromDate(seenAt),
          priority: true,
        }),
      ])
    },
  })
}
