import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preference } from '../../../../lexicon/types/app/bsky/notification/defs'
import { Method } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putPreferencesV2({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss
      const namespace = 'app.bsky.notification.defs#preferences'
      const key = 'self'
      const entry = { ...input.body }

      // await ctx.vaultClient.create({})

      await ctx.bsyncClient.putOperation({
        actorDid,
        namespace,
        key,
        payload: Buffer.from(JSON.stringify(entry)),
        method: Method.CREATE,
      })

      return {
        encoding: 'application/json',
        body: {
          preferences: {
            likeNotification: emptyPreference(),
            repostNotification: emptyPreference(),
            followNotification: emptyPreference(),
            replyNotification: emptyPreference(),
            mentionNotification: emptyPreference(),
            quoteNotification: emptyPreference(),
            starterpackJoinedNotification: emptyPreference(),
            verifiedNotification: emptyPreference(),
            unverifiedNotification: emptyPreference(),
            likeViaRepostNotification: emptyPreference(),
            repostViaRepostNotification: emptyPreference(),
            subscribedPostNotification: emptyPreference(),
            chatNotification: emptyPreference(),
            ...entry,
          },
        },
      }
    },
  })
}

const emptyPreference = (): Preference => ({
  channels: {
    inApp: false,
    push: false,
  },
  filter: 'all',
})
