import { Server } from '../../../../../lexicon'
import * as lex from '../../../../../lexicon/lexicons'
import AppContext from '../../../../../context'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActorList({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.did

      const listUri = new AtUri(list)
      const collId = lex.ids.AppBskyGraphList
      if (listUri.collection !== collId) {
        throw new InvalidRequestError(`Invalid collection: expected: ${collId}`)
      }

      if (ctx.canProxyWrite()) {
        await ctx.appviewAgent.api.app.bsky.graph.muteActorList(input.body, {
          ...(await ctx.serviceAuthHeaders(requester)),
          encoding: 'application/json',
        })
      }

      await ctx.services.account(ctx.db).muteActorList({
        list,
        mutedByDid: requester,
      })
    },
  })
}
