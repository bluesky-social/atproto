import { DAY } from '@atproto/common'
import {
  Server,
  UpstreamTimeoutError,
  parseReqEncoding,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.uploadBlob, {
    auth: ctx.authVerifier.authorizationOrUserServiceAuth({
      checkTakedown: true,
      authorize: (permissions, { req }) => {
        const encoding = parseReqEncoding(req)
        permissions.assertBlob({ mime: encoding })
      },
    }),
    rateLimit: {
      durationMs: DAY,
      points: 1000,
    },
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      const blob = await ctx.actorStore.writeNoTransaction(
        requester,
        async (store) => {
          const metadata = await store.repo.blob
            .uploadBlobAndGetMetadata(input.encoding, input.body)
            .catch(throwAbortAsUpstreamError)

          return store.transact(async (actorTxn) => {
            const blobRef =
              await actorTxn.repo.blob.trackUntetheredBlob(metadata)

            // make the blob permanent if an associated record is already indexed
            if (await actorTxn.repo.blob.hasRecordsForBlob(blobRef.ref)) {
              await actorTxn.repo.blob.verifyBlobAndMakePermanent(blobRef)
            }

            return blobRef
          })
        },
      )

      return {
        encoding: 'application/json' as const,
        body: { blob },
      }
    },
  })
}

function throwAbortAsUpstreamError(err: unknown): never {
  if (err?.['name'] === 'AbortError') {
    throw new UpstreamTimeoutError('Operation timed out, please try again.')
  }
  throw err
}
