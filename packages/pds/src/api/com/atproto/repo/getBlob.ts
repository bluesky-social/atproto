import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getBlob(async ({ params }) => {
    const cid = CID.parse(params.cid)
    const blobStream = await ctx.blobstore.getBytes(cid)
    return {
      encoding: 'application/octet-stream',
      body: blobStream,
    }
  })
}
