import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { isUserOrAdmin } from '../../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getHead({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(
            `Could not find root for DID: ${did}`,
            'HeadNotFound',
          )
        }
      }
      const root = await ctx.actorStore.read(did, (store) => {
        return store.repo.storage.getRoot()
      })
      if (root === null) {
        throw new InvalidRequestError(
          `Could not find root for DID: ${did}`,
          'HeadNotFound',
        )
      }
      return {
        encoding: 'application/json',
        body: { root: root.toString() },
      }
    },
  })
}
