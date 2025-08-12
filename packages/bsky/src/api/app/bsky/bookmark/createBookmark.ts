import { TID } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Bookmark } from '../../../../lexicon/types/app/bsky/bookmark/defs'
import { Namespaces } from '../../../../stash'
import { getExistingKey, validateUri } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.bookmark.createBookmark({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { uri } = input.body
      validateUri(uri)

      const existingKey = await getExistingKey(ctx, actorDid, uri)
      if (existingKey) {
        throw new InvalidRequestError('Bookmark already exists', 'Duplicated')
      }

      await ctx.stashClient.create({
        actorDid,
        namespace: Namespaces.AppBskyBookmarkDefsBookmark,
        payload: {
          uri,
        } satisfies Bookmark,
        key: TID.nextStr(),
      })
    },
  })
}
