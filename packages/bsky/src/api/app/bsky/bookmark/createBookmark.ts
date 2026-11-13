import { TID } from '@atproto/common'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { Namespaces } from '../../../../stash.js'
import { validateUri } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.bookmark.createBookmark, {
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
        } satisfies app.bsky.bookmark.defs.Bookmark,
        key: TID.nextStr(),
      })
    },
  })
}
