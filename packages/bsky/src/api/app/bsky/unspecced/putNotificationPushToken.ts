import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.putNotificationPushToken({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { token, platform } = params
      const {
        credentials: { did },
      } = auth
      const db = ctx.db.db
      const ret = await db
        .insertInto('notification_push_token')
        .values({
          did,
          token,
          platform,
        })
        .execute()
      console.log('ret', ret)
    },
  })
}
