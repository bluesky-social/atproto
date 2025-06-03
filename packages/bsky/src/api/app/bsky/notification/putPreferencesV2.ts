import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Preference } from '../../../../lexicon/types/app/bsky/notification/defs'
import { Method } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putPreferencesV2({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss
      const collection = 'com.test.notification.preferences'
      const rkey = 'self'
      const record = { ...input.body }

      await ctx.bsyncClient.putOperation({
        actorDid,
        collection,
        rkey,
        payload: Buffer.from(JSON.stringify(record)),
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
            ...record,
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
