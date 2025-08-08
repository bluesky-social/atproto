import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.listMissingBlobs({
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ auth, params }) => {
      const { did } = auth.credentials
      const { limit, cursor } = params

      const blobs = await ctx.actorStore.read(did, (store) =>
        store.repo.blob.listMissingBlobs({ limit, cursor }),
      )

      return {
        encoding: 'application/json',
        body: {
          blobs,
          cursor: blobs.at(-1)?.cid,
        },
      }
    },
  })
}
