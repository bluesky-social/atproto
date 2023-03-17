import { AtUri } from '@atproto/uri'
import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import * as repo from '../../../../repo'
import AppContext from '../../../../context'
import {
  InvalidRecordError,
  PreparedCreate,
  PreparedUpdate,
} from '../../../../repo'
import SqlRepoStorage from '../../../../sql-repo-storage'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.putRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const {
        did,
        collection,
        rkey,
        record,
        validate,
        swapCommit,
        swapRecord,
      } = input.body

      if (did !== auth.credentials.did) {
        throw new ForbiddenError()
      }
      if (collection !== ids.AppBskyActorProfile || rkey !== 'self') {
        // @TODO temporary
        throw new InvalidRequestError(
          `Temporarily only accepting puts for ${ids.AppBskyActorProfile}/self.`,
        )
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const write = await ctx.db.transaction(async (dbTxn) => {
        const recordTxn = ctx.services.record(dbTxn)
        const repoTxn = ctx.services.repo(dbTxn)

        const now = new Date().toISOString()
        const storage = new SqlRepoStorage(dbTxn, did, now)
        const pinned = await storage.getPinnedAtHead()

        const uri = AtUri.make(did, collection, rkey)
        const current = await recordTxn.getRecord(uri, null, true)
        const writeInfo = { did, collection, rkey, record, validate }

        let write: PreparedCreate | PreparedUpdate
        try {
          write = current
            ? await repo.prepareUpdate(writeInfo)
            : await repo.prepareCreate(writeInfo)
        } catch (err) {
          if (err instanceof InvalidRecordError) {
            throw new InvalidRequestError(err.message)
          }
          throw err
        }

        if (swapCommit && swapCommit !== pinned.head?.toString()) {
          throw new InvalidRequestError(
            `Commit was at ${pinned.head?.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }
        if (
          (swapRecord === null && current !== null) ||
          (swapRecord && swapRecord !== current?.cid)
        ) {
          throw new InvalidRequestError(
            `Record was at ${current?.cid.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }

        await repoTxn.processWrites(did, [write], now, pinned)
        return write
      })

      return {
        encoding: 'application/json',
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
        },
      }
    },
  })
}
