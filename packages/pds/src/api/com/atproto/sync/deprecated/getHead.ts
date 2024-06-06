import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { assertRepoAvailability } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getHead({
    auth: ctx.authVerifier.optionalAccessOrAdminToken,
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

      const root = await ctx.actorStore.read(did, (store) =>
        store.repo.storage.getRoot(),
      )
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
