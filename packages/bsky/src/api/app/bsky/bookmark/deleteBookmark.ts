import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Namespaces } from '../../../../stash'
import { validateUri } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.bookmark.deleteBookmark({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { uri } = input.body
      validateUri(uri)

      const res = await ctx.dataplane.getBookmarksByActorAndSubjects({
        actorDid,
        uris: [uri],
      })
      const [existing] = res.bookmarks
      if (!existing.ref?.key) {
        // Idempotent, return without deleting.
        return
      }

      await ctx.stashClient.delete({
        actorDid,
        namespace: Namespaces.AppBskyBookmarkDefsBookmark,
        key: existing.ref.key,
      })
    },
  })
}
