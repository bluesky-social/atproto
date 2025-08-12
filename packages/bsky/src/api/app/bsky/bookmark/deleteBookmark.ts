import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Namespaces } from '../../../../stash'
import { getExistingKey, validateUri } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.bookmark.deleteBookmark({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { uri } = input.body
      validateUri(uri)

      const existingKey = await getExistingKey(ctx, actorDid, uri)
      if (!existingKey) {
        throw new InvalidRequestError('Bookmark does not exist', 'NotFound')
      }

      await ctx.stashClient.delete({
        actorDid,
        namespace: Namespaces.AppBskyBookmarkDefsBookmark,
        key: existingKey,
      })
    },
  })
}
