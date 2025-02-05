import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRepoAvailability } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getLatestCommit({
    auth: ctx.authVerifier.optionalAccessOrAdminToken(),
    handler: async ({ params, auth }) => {
      const { did } = params
      await assertRepoAvailability(
        ctx,
        did,
        ctx.authVerifier.isUserOrAdmin(auth, did),
      )

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
