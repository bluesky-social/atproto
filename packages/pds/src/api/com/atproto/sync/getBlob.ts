import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobNotFoundError } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, res, auth }) => {
      if (!ctx.authVerifier.isUserOrAdmin(auth, params.did)) {
        const available = await ctx.accountManager.isRepoAvailable(params.did)
        if (!available) {
          console.log('!available blob not found')
          throw new InvalidRequestError('Blob not found')
        }
      }
      const cid = CID.parse(params.cid)
      const found = await ctx.actorStore.read(params.did, async (store) => {
        try {
          return await store.repo.blob.getBlob(cid)
        } catch (err) {
          if (err instanceof BlobNotFoundError) {
            console.log('actorStore! blob not found')
            throw new InvalidRequestError('Blob not found')
          } else {
            console.log('actorStore! outside blob not found', err)
            throw err
          }
        }
      })
      if (!found) {
        console.log('!found blob not found')
        throw new InvalidRequestError('Blob not found')
      }
      res.setHeader('content-length', found.size)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)
      return {
        // @TODO better codegen for */* mimetype
        encoding: (found.mimeType || 'application/octet-stream') as '*/*',
        body: found.stream,
      }
    },
  })
}
