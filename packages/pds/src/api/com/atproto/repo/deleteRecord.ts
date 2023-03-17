import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import SqlRepoStorage from '../../../../sql-repo-storage'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.deleteRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, rkey, swapCommit, swapRecord } = input.body
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }

      const now = new Date().toISOString()
      const write = repo.prepareDelete({ did, collection, rkey })
      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        const recordTxn = ctx.services.record(dbTxn)
        const storage = new SqlRepoStorage(dbTxn, did, now)
        const pinned = await storage.getPinnedAtHead()
        const record = await recordTxn.getRecord(write.uri, null, true)
        if (swapCommit && swapCommit !== pinned.head?.toString()) {
          throw new InvalidRequestError(
            `Commit was at ${pinned.head?.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }
        if (swapRecord && swapRecord !== record?.cid) {
          throw new InvalidRequestError(
            `Record was at ${record?.cid.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }
        if (!record) {
          return // No-op if record already doesn't exist
        }
        await repoTxn.processWrites(did, [write], now, pinned)
      })
    },
  })
}
