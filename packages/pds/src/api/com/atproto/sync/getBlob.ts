import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobNotFoundError } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob(async ({ params, res }) => {
    const found = await ctx.db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', params.cid)
      .where('creator', '=', params.did)
      .executeTakeFirst()
    if (!found) {
      throw new InvalidRequestError(`blob not found: ${params.cid}`)
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
  })
}
