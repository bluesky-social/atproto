import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.listBlobs({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did, since, limit, cursor } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find root for DID: ${did}`)
        }
      }

      const blobCids = await ctx.actorStore
        .reader(did)
        .repo.blob.listBlobs({ since, limit, cursor })

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
