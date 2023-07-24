import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { isUserOrAdmin } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getCommitPath({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find root for DID: ${did}`)
        }
      }
      const storage = new SqlRepoStorage(ctx.db, did)
      const earliest = params.earliest ? CID.parse(params.earliest) : null
      const latest = params.latest
        ? CID.parse(params.latest)
        : await storage.getHead()
      if (latest === null) {
        throw new InvalidRequestError(`Could not find root for DID: ${did}`)
      }
      const commitPath = await storage.getCommitPath(latest, earliest)
      if (commitPath === null) {
        throw new InvalidRequestError(
          `Could not find a valid commit path from ${latest.toString()} to ${earliest?.toString()}`,
        )
      }
      const commits = commitPath.map((c) => c.toString())
      return {
        encoding: 'application/json',
        body: { commits },
      }
    },
  })
}
