import { DAY } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.prepareBlobUploadUrl({
    auth: ctx.authVerifier.accessStandard({
      checkTakedown: true,
    }),
    rateLimit: {
      durationMs: DAY,
      points: 1000,
    },
    handler: async ({ auth, input }) => {
      const { mimeType, collection, size } = input.body
      const body = {
        mimeType,
        size,
        collection,
        requester: auth.credentials.did,
      }
      const blobSvcUrl = ctx.cfg.service.blobServiceUrl
      try {
        const response = await fetch(`${blobSvcUrl}/presigned-url`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        // TODO: Have PDS create upload id directly
        const { url, uploadId } = (await response.json()) as any
        return {
          encoding: 'application/json',
          body: {
            url,
            uploadId,
          },
        }
      } catch (err) {
        throw new InvalidRequestError('Failed to get presigned URL')
      }
    },
  })
}
