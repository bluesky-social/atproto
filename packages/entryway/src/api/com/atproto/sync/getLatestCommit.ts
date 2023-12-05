import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getLatestCommit({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
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
      const storage = new SqlRepoStorage(ctx.db, did)
      const root = await storage.getRootDetailed()
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
