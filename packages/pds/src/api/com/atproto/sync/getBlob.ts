import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

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
    const blobStream = await ctx.blobstore.getStream(cid)
    res.setHeader('Content-Length', found.size)
    // @TODO better codegen for */* mimetype
    return {
      encoding: (found.mimeType || 'application/octet-stream') as '*/*',
      body: blobStream,
    }
  })
}
