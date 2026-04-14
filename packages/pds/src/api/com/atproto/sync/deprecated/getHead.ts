import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { isUserOrAdmin } from '../../../../../auth-verifier'
import { AppContext } from '../../../../../context'
import { com } from '../../../../../lexicons/index.js'
import { assertRepoAvailability } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.sync.getHead, {
    auth: ctx.authVerifier.authorizationOrAdminTokenOptional({
      authorize: () => {
        // always allow
      },
    }),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(ctx, did, isUserOrAdmin(auth, did))

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
        encoding: 'application/json' as const,
        body: { root: root.toString() },
      }
    },
  })
}
