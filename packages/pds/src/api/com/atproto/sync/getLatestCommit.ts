import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getLatestCommit({
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
            'RepoNotFound',
          )
        }
      }
      const root = await ctx.actorStore.read(did, (store) =>
        store.repo.storage.getRootDetailed(),
      )
      if (root === null) {
        throw new InvalidRequestError(
          `Could not find root for DID: ${did}`,
          'RepoNotFound',
        )
      }
      return {
        encoding: 'application/json',
        body: { cid: root.cid.toString(), rev: root.rev },
      }
    },
  })
}
