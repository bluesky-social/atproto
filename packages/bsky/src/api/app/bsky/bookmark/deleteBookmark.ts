import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Namespaces } from '../../../../stash'
import { validateUri } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.bookmark.deleteBookmark({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const {
        bookmark: { subject },
      } = input.body
      validateUri(subject.uri)

      const res = await ctx.dataplane.getBookmarksByActorAndSubjects({
        actorDid,
        uris: [subject.uri],
      })
      const [existing] = res.bookmarks
      if (!existing.key) {
        // Idempotent, return without deleting.
        return
      }
      if (existing.subject?.cid !== subject.cid) {
        throw new InvalidRequestError(
          'Bookmark exists but with a different CID',
          'DifferentCid',
        )
      }

      await ctx.stashClient.delete({
        actorDid,
        namespace: Namespaces.AppBskyBookmarkDefsBookmark,
        key: existing.key,
      })
    },
  })
}
