import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  isCreate,
  isUpdate,
  isDelete,
} from '../../../../lexicon/types/com/atproto/repo/applyWrites'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedWrite,
} from '../../../../repo'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.applyWrites({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const tx = input.body
      const { did, validate, swapCommit } = tx
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const hasUpdate = tx.writes.some(isUpdate)
      if (hasUpdate) {
        throw new InvalidRequestError(`Updates are not yet supported.`)
      }

      let writes: PreparedWrite[]
      try {
        writes = await Promise.all(
          tx.writes.map((write) => {
            if (isCreate(write)) {
              return repo.prepareCreate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (isDelete(write)) {
              return repo.prepareDelete({
                did,
                collection: write.collection,
                rkey: write.rkey,
              })
            } else {
              throw new InvalidRequestError(
                `Action not supported: ${write['$type']}`,
              )
            }
          }),
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      const now = new Date().toISOString()
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        try {
          await repoTxn.processWrites(did, writes, now, swapCommitCid)
        } catch (err) {
          if (err instanceof BadCommitSwapError) {
            throw new InvalidRequestError(err.message, 'InvalidSwap')
          } else {
            throw err
          }
        }
      })
    },
  })
}
