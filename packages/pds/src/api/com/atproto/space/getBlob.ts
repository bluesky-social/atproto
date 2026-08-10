import { parseCid } from '@atproto/lex-data'
import { BlobNotFoundError } from '@atproto/repo'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, isSpaceSelfRead } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getBlob, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth, res }) => {
      const { space, repo } = params

      assertSpaceRead(auth, space, repo)
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const cid = parseCid(params.cid)
      const found = await ctx.actorStore.read(repo, async (store) => {
        try {
          return await store.repo.blob.getBlob(cid)
        } catch (err) {
          if (err instanceof BlobNotFoundError) {
            throw new InvalidRequestError('Blob not found', 'BlobNotFound')
          } else {
            throw err
          }
        }
      })
      if (!found) {
        throw new InvalidRequestError('Blob not found', 'BlobNotFound')
      }
      res.setHeader('content-length', found.size)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-disposition', `attachment; filename="${cid}"`)
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)

      return {
        encoding: found.mimeType || ('application/octet-stream' as const),
        body: found.stream,
      }
    },
  })
}
