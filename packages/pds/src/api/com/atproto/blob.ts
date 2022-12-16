import { Server } from '../../../lexicon'
import ServerAuth from '../../../auth'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.blob.upload({
    auth: ServerAuth.verifier,
    handler: async ({ input }) => {
      const cid = await ctx.services
        .repo(ctx.db)
        .blobs.addUntetheredBlob(input.encoding, input.body)

      return {
        encoding: 'application/json',
        body: {
          cid: cid.toString(),
        },
      }
    },
  })
}
