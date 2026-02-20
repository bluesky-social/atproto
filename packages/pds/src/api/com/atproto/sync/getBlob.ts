import { parseCid } from '@atproto/lex-data'
import { BlobNotFoundError } from '@atproto/repo'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getBlob, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, res, auth }) => {
      const { did } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const cid = parseCid(params.cid)
      const found = await ctx.actorStore.read(params.did, async (store) => {
        try {
          return await store.repo.blob.getBlob(cid)
        } catch (err) {
          if (err instanceof BlobNotFoundError) {
            throw new InvalidRequestError('Blob not found')
          } else {
            throw err
          }
        }
      })
      if (!found) {
        throw new InvalidRequestError('Blob not found')
      }
      res.setHeader('content-length', found.size)

      // Important Security headers

      // This prevents the browser from trying to guess the content type
      // and potentially loading the blob as executable code, or rendering it
      // in some other unsafe way.
      res.setHeader('x-content-type-options', 'nosniff')

      // This forces the browser to download the blob instead of trying to
      // render it when visiting the URL. This is important to prevent XSS
      // attacks if the blob happens to be HTML. Even if JS is disabled via the
      // CSP header below, a blob could still contain malicious HTML links.
      res.setHeader('content-disposition', `attachment; filename="${cid}"`)

      // This should prevent the browser from executing the blob in any way
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)

      return {
        encoding: found.mimeType || ('application/octet-stream' as const),
        body: found.stream,
      }
    },
  })
}
