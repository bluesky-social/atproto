import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { assertRepoAvailability } from './util'
import { AuthScope } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.listBlobs({
    auth: ctx.authVerifier.optionalAccessOrAdminToken({
      additional: [AuthScope.Takendown],
    }),
    handler: async ({ params, auth }) => {
      const { did, since, limit, cursor } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

      const blobCids = await ctx.actorStore.read(did, (store) =>
        store.repo.blob.listBlobs({ since, limit, cursor }),
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: blobCids.at(-1),
          cids: blobCids,
        },
      }
    },
  })
}
