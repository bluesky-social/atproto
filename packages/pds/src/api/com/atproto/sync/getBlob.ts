import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob(async ({ params }) => {
    const cid = CID.parse(params.cid)
    const blobStream = await ctx.blobstore.getStream(cid)
    // @TODO better codegen for */* mimetype
    return {
      encoding: 'application/octet-stream' as any,
      body: blobStream,
    }
  })
}
