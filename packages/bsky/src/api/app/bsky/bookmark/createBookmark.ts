import { TID } from '@atproto/common'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Bookmark } from '../../../../lexicon/types/app/bsky/bookmark/defs'
import { Namespaces } from '../../../../stash'
import { validateUri } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.bookmark.createBookmark({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { cid, uri } = input.body
      validateUri(uri)

      const res = await ctx.dataplane.getBookmarksByActorAndSubjects({
        actorDid,
        uris: [uri],
      })
      const [existing] = res.bookmarks
      if (existing.ref?.key) {
        // Idempotent, return without creating.
        return
      }

      await ctx.stashClient.create({
        actorDid,
        namespace: Namespaces.AppBskyBookmarkDefsBookmark,
        payload: {
          subject: {
            cid,
            uri,
          },
        } satisfies Bookmark,
        key: TID.nextStr(),
      })
    },
  })
}
