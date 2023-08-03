import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'

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
      const createRecord = db.insertInto('notification_push_token').values({
        did,
        token,
        platform,
      })
    },
  })
}
