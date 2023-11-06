import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.pushBlob({
    auth: ctx.authVerifier.role,
    handler: async ({ params, input }) => {
      const { did } = params

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const blob = await actorTxn.repo.blob.addUntetheredBlob(
          input.encoding,
          input.body,
        )
        await actorTxn.repo.blob.verifyBlobAndMakePermanent({
          mimeType: blob.mimeType,
          cid: blob.ref,
          constraints: {},
        })
      })
    },
  })
}
