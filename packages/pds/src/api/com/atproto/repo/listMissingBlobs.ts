import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.listMissingBlobs, {
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
        encoding: 'application/json' as const,
        body: {
          blobs,
          cursor: blobs.at(-1)?.cid,
        },
      }
    },
  })
}
