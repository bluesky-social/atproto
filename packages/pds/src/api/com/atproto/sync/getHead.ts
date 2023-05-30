import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { isUserOrAdmin } from '../../../../auth'
import { softDeleted } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getHead({
    auth: ctx.optionalAccessOrAdminVerifier,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const account = await ctx.services.account(ctx.db).getAccount(did, true)
        if (!account || softDeleted(account)) {
          throw new InvalidRequestError(`Could not find root for DID: ${did}`)
        }
      }
      const storage = new SqlRepoStorage(ctx.db, did)
      const root = await storage.getHead()
      if (root === null) {
        throw new InvalidRequestError(`Could not find root for DID: ${did}`)
      }
      return {
        encoding: 'application/json',
        body: { root: root.toString() },
      }
    },
  })
}
