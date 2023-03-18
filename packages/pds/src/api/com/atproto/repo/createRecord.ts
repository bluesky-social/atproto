import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import { InvalidRecordError, PreparedCreate } from '../../../../repo'
import AppContext from '../../../../context'
import SqlRepoStorage from '../../../../sql-repo-storage'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.createRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, rkey, record, swapCommit, validate } = input.body
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const now = new Date().toISOString()

      let write: PreparedCreate
      try {
        write = await repo.prepareCreate({
          did,
          collection,
          record,
          rkey: rkey || repo.determineRkey(),
          validate,
        })
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        const storage = new SqlRepoStorage(dbTxn, did, now)
        const pinned = await storage.getPinnedAtHead()
        if (swapCommit && swapCommit !== pinned.head?.toString()) {
          throw new InvalidRequestError(
            `Commit was at ${pinned.head?.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }
        await repoTxn.processWrites(did, [write], now, pinned)
      })

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })
}
