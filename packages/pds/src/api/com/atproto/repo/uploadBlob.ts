import { DAY } from '@atproto/common'
import {
  type Server,
  UpstreamTimeoutError,
  parseReqEncoding,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
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
  // Blob store timeouts surface as AbortError (total upload timeout) or
  // TimeoutError (stalled connection), possibly wrapped as an error cause
  // (e.g. S3BlobStore's "Blob upload timed out" error). The depth limit
  // guards against (pathological) cyclic cause chains.
  for (let e = err, depth = 0; e instanceof Error && depth < 10; depth++) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      throw new UpstreamTimeoutError('Operation timed out, please try again.')
    }
    e = e.cause
  }
  throw err
}
