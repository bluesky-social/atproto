import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.unmutePostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const { threadRoot } = input.body

      await ctx.db.db
        .deleteFrom('thread_mute')
        .where('did', '=', requester)
        .where('threadRoot', '=', threadRoot)
        .execute()
    },
  })
}
