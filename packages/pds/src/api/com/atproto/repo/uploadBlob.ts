import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { DAY } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.uploadBlob({
    auth: ctx.authVerifier.accessCheckTakedown,
    rateLimit: {
      durationMs: DAY,
      points: 1000,
    },
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      const blob = await ctx.actorStore.transact(
        requester,
        async (actorTxn) => {
          const blob = await actorTxn.repo.blob.addUntetheredBlob(
            input.encoding,
            input.body,
          )

          // make the blob permanent if an associated record is already indexed
          const recordsForBlob = await actorTxn.repo.blob.getRecordsForBlob(
            blob.ref,
          )
          if (recordsForBlob.length > 0) {
            await actorTxn.repo.blob.verifyBlobAndMakePermanent({
              cid: blob.ref,
              mimeType: blob.mimeType,
              constraints: {},
            })
          }

          return blob
        },
      )

      return {
        encoding: 'application/json',
        body: {
          blob,
        },
      }
    },
  })
}
