import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import * as lex from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'
import { AtUri } from '@atproto/uri'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.saveFeed({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { feed } = input.body
      const requester = auth.credentials.did

      const feedUri = new AtUri(feed)
      const collId = lex.ids.AppBskyFeedGenerator
      if (feedUri.collection !== collId) {
        throw new InvalidRequestError(`Invalid collection. Expected: ${collId}`)
      }

      await ctx.db.db
        .insertInto('saved_feed')
        .values({
          userDid: requester,
          feedUri: feedUri.toString(),
          createdAt: new Date().toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    },
  })
}
