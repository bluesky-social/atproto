import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { notSoftDeletedClause } from '../../../../db/util'
import { BlobNotFoundError } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, res, auth }) => {
      const { ref } = ctx.db.db.dynamic
      const { did } = params

      if (!ctx.authVerifier.isUserOrAdmin(auth, params.did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }

      const found = await ctx.db.db
        .selectFrom('blob')
        .selectAll()
        .innerJoin('repo_blob', (join) =>
          join
            .onRef('repo_blob.cid', '=', 'blob.cid')
            .onRef('repo_blob.did', '=', 'blob.creator'),
        )
        .where('blob.cid', '=', params.cid)
        .where('blob.creator', '=', params.did)
        .where(notSoftDeletedClause(ref('repo_blob')))
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError('Blob not found')
      }
      const cid = CID.parse(params.cid)
      let blobStream
      try {
        blobStream = await ctx.blobstore.getStream(cid)
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          throw new InvalidRequestError('Blob not found')
        }
        throw err
      }
      res.setHeader('content-length', found.size)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)
      return {
        // @TODO better codegen for */* mimetype
        encoding: (found.mimeType || 'application/octet-stream') as '*/*',
        body: blobStream,
      }
    },
  })
}
