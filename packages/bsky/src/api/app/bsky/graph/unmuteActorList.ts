import assert from 'node:assert'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'
import { BsyncClient } from '../../../../bsync'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.authVerifier.standard,
    handler: async ({ req, auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.iss
      const db = ctx.db.getPrimary()

      const unmuteActorList = async () => {
        await ctx.services.graph(db).unmuteActorList({
          list,
          mutedByDid: requester,
        })
      }

      const addBsyncMuteOp = async (bsyncClient: BsyncClient) => {
        await bsyncClient.addMuteOperation({
          type: MuteOperation_Type.REMOVE,
          actorDid: requester,
          subject: list,
        })
      }

      if (ctx.cfg.bsyncOnlyMutes) {
        assert(ctx.bsyncClient)
        await addBsyncMuteOp(ctx.bsyncClient)
      } else {
        await unmuteActorList()
        if (ctx.bsyncClient) {
          try {
            await addBsyncMuteOp(ctx.bsyncClient)
          } catch (err) {
            req.log.warn(err, 'failed to sync mute op to bsync')
          }
        }
      }
    },
  })
}
