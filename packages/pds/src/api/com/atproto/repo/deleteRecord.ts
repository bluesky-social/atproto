import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { BadCommitSwapError, BadRecordSwapError } from '../../../../repo'
import { CID } from 'multiformats/cid'

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
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid = swapRecord ? CID.parse(swapRecord) : undefined

      const write = repo.prepareDelete({
        did,
        collection,
        rkey,
        swapCid: swapRecordCid,
      })

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
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
      })
    },
  })
}
