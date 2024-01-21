import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import * as lex from '../../../../lexicon/lexicons'
import AppContext from '../../../../context'
import { AtUri } from '@atproto/syntax'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActorList({
    auth: ctx.authVerifier.standard,
    handler: async ({ req, auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.iss

      const db = ctx.db.getPrimary()

      const listUri = new AtUri(list)
      const collId = lex.ids.AppBskyGraphList
      if (listUri.collection !== collId) {
        throw new InvalidRequestError(`Invalid collection: expected: ${collId}`)
      }

      if (!ctx.cfg.bsyncOnlyMutes) {
        await ctx.services.graph(db).muteActorList({
          list,
          mutedByDid: requester,
        })
      } else {
        assert(ctx.bsyncClient)
      }

      if (ctx.bsyncClient) {
        try {
          await ctx.bsyncClient.addMuteOperation({
            type: MuteOperation_Type.ADD,
            actorDid: requester,
            subject: list,
          })
        } catch (err) {
          req.log.warn(err, 'failed to sync mute op to bsync')
        }
      }
    },
  })
}
