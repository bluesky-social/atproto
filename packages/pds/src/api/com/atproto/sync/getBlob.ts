import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { notSoftDeletedClause } from '../../../../db/util'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, res, auth }) => {
      const { ref } = ctx.db.db.dynamic
      const found = await ctx.db.db
        .selectFrom('blob')
        .selectAll()
        .innerJoin('repo_root', 'repo_root.did', 'blob.creator')
        .innerJoin('repo_blob', (join) =>
          join
            .onRef('repo_blob.cid', '=', 'blob.cid')
            .onRef('repo_blob.did', '=', 'blob.creator'),
        )
        .where('blob.cid', '=', params.cid)
        .where('blob.creator', '=', params.did)
        .where(notSoftDeletedClause(ref('repo_blob')))
        .if(!isUserOrAdmin(auth, params.did), (qb) =>
          // takedown check for anyone other than an admin or the user
          qb.where(notSoftDeletedClause(ref('repo_root'))),
        )
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError(`blob not found: ${params.cid}`)
      }
      const cid = CID.parse(params.cid)
      const blobStream = await ctx.blobstore.getStream(cid)
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
