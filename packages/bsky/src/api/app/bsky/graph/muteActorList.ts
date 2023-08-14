import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import * as lex from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'
import { AtUri } from '@atproto/uri'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActorList({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.did

      const db = ctx.db.getPrimary()

      const listUri = new AtUri(list)
      const collId = lex.ids.AppBskyGraphList
      if (listUri.collection !== collId) {
        throw new InvalidRequestError(`Invalid collection: expected: ${collId}`)
      }

      await ctx.services.graph(db).muteActorList({
        list,
        mutedByDid: requester,
      })
    },
  })
}
