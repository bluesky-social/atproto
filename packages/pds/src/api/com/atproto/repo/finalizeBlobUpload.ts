import { DAY } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.finalizeBlobUpload({
    auth: ctx.authVerifier.accessStandard({
      checkTakedown: true,
    }),
    rateLimit: {
      durationMs: DAY,
      points: 1000,
    },
    handler: async ({ auth, input }) => {
      try {
        // TODO: Blob is in input body but is unused
        const { uploadId } = input.body
        const blobSvcUrl = ctx.cfg.service.blobServiceUrl

        const uploadResponse = await fetch(`${blobSvcUrl}/upload/${uploadId}`)

        if (!uploadResponse.ok) {
          throw new InvalidRequestError('Failed to fetch upload')
        }
        const uploadData = await uploadResponse.json()
        const blobRef = (uploadData as any).blobRef
        await ctx.actorStore.transact(auth.credentials.did, async (actorTxn) =>
          actorTxn.repo.blob.saveBlobRef(blobRef),
        )
        return {
          encoding: 'application/json',
          body: {},
        }
      } catch (err) {
        throw new InvalidRequestError('Failed to get finalize upload')
      }
    },
  })
}
