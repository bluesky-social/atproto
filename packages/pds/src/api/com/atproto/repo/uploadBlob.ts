import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.uploadBlob({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const blob = await ctx.services
        .repo(ctx.db)
        .blobs.addUntetheredBlob(requester, input.encoding, input.body)

      return {
        encoding: 'application/json',
        body: {
          blob,
        },
      }
    },
  })
}
