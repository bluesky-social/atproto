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

      const blob = await ctx.actorStore.writeNoTransaction(
        requester,
        async (store) => {
          const metadata = await store.repo.blob.uploadBlobAndGetMetadata(
            input.encoding,
            input.body,
          )

          return store.transact(async (actorTxn) => {
            const blobRef = await actorTxn.repo.blob.trackUntetheredBlob(
              metadata,
            )

            // make the blob permanent if an associated record is already indexed
            const recordsForBlob = await actorTxn.repo.blob.getRecordsForBlob(
              blobRef.ref,
            )
            if (recordsForBlob.length > 0) {
              await actorTxn.repo.blob.verifyBlobAndMakePermanent({
                cid: blobRef.ref,
                mimeType: blobRef.mimeType,
                constraints: {},
              })
            }

            return blobRef
          })
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
