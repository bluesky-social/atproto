import { Server } from '../../../lexicon'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.blob.upload({
    auth: ctx.accessVerifierCheckTakedown,
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
