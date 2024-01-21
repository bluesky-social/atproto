import assert from 'node:assert'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.authVerifier.standard,
    handler: async ({ req, auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.iss
      const db = ctx.db.getPrimary()

      if (!ctx.cfg.bsyncOnlyMutes) {
        await ctx.services.graph(db).unmuteActorList({
          list,
          mutedByDid: requester,
        })
      } else {
        assert(ctx.bsyncClient)
      }

      if (ctx.bsyncClient) {
        try {
          await ctx.bsyncClient.addMuteOperation({
            type: MuteOperation_Type.REMOVE,
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
