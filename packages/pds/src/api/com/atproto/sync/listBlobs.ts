import { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope'
import { isUserOrAdmin } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.listBlobs, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did, since, limit = 500, cursor } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

      const blobCids = await ctx.actorStore.read(did, (store) =>
        store.repo.blob.listBlobs({ since, limit, cursor }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: blobCids.at(-1),
          cids: blobCids,
        },
      }
    },
  })
}
