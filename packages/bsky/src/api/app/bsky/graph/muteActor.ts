import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'
import { BsyncClient } from '../../../../bsync'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
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

      const muteActor = async () => {
        await ctx.services.graph(db).muteActor({
          subjectDid,
          mutedByDid: requester,
        })
      }

      const addBsyncMuteOp = async (bsyncClient: BsyncClient) => {
        await bsyncClient.addMuteOperation({
          type: MuteOperation_Type.ADD,
          actorDid: requester,
          subject: subjectDid,
        })
      }

      if (ctx.cfg.bsyncOnlyMutes) {
        assert(ctx.bsyncClient)
        await addBsyncMuteOp(ctx.bsyncClient)
      } else {
        await muteActor()
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
