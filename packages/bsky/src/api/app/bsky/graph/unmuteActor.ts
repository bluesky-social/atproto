import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'
import { BsyncClient } from '../../../../bsync'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActor({
    auth: ctx.authVerifier.standard,
    handler: async ({ req, auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.iss
      const db = ctx.db.getPrimary()

      const subjectDid = await ctx.services.actor(db).getActorDid(actor)
      if (!subjectDid) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }
      if (subjectDid === requester) {
        throw new InvalidRequestError('Cannot mute oneself')
      }

      const unmuteActor = async () => {
        await ctx.services.graph(db).unmuteActor({
          subjectDid,
          mutedByDid: requester,
        })
      }

      const addBsyncMuteOp = async (bsyncClient: BsyncClient) => {
        await bsyncClient.addMuteOperation({
          type: MuteOperation_Type.REMOVE,
          actorDid: requester,
          subject: subjectDid,
        })
      }

      if (ctx.cfg.bsyncOnlyMutes) {
        assert(ctx.bsyncClient)
        await addBsyncMuteOp(ctx.bsyncClient)
      } else {
        await unmuteActor()
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
