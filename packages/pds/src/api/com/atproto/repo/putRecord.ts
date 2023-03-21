import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import * as repo from '../../../../repo'
import AppContext from '../../../../context'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  InvalidRecordError,
  PreparedCreate,
  PreparedUpdate,
} from '../../../../repo'

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

      const now = new Date().toISOString()
      const uri = AtUri.make(did, collection, rkey)
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid =
        typeof swapRecord === 'string' ? CID.parse(swapRecord) : swapRecord

      const write = await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        const recordTxn = ctx.services.record(dbTxn)

        const current = await recordTxn.getRecord(uri, null, true)
        const writeInfo = {
          did,
          collection,
          rkey,
          record,
          swapCid: swapRecordCid,
          validate,
        }

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

        try {
          await repoTxn.processWrites(did, [write], now, swapCommitCid)
        } catch (err) {
          if (
            err instanceof BadCommitSwapError ||
            err instanceof BadRecordSwapError
          ) {
            throw new InvalidRequestError(err.message, 'InvalidSwap')
          } else {
            throw err
          }
        }
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
