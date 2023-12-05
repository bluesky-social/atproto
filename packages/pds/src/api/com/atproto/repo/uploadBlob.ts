import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.uploadBlob({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      const blob = await ctx.actorStore.transact(requester, (actorTxn) => {
        return actorTxn.repo.blob.addUntetheredBlob(input.encoding, input.body)
      })

      return {
        encoding: 'application/json',
        body: {
          blob,
        },
      }
    },
  })
}
