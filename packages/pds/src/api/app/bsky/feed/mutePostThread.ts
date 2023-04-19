import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.mutePostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const { threadRoot } = input.body

      await ctx.db.db
        .insertInto('thread_mute')
        .values({ did: requester, threadRoot })
        .onConflict((oc) => oc.doNothing())
        .execute()
    },
  })
}
