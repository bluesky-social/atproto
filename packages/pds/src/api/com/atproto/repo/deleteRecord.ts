import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { BadCommitSwapError, BadRecordSwapError } from '../../../../repo'
import { CID } from 'multiformats/cid'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.deleteRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { repo, collection, rkey, swapCommit, swapRecord } = input.body
      const did = await ctx.services.account(ctx.db).getDidForActor(repo)

      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      const now = new Date().toISOString()
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid = swapRecord ? CID.parse(swapRecord) : undefined

      const write = prepareDelete({
        did,
        collection,
        rkey,
        swapCid: swapRecordCid,
      })

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        const recordTxn = ctx.services.record(dbTxn)
        const record = await recordTxn.getRecord(write.uri, null, true)
        if (!record) {
          return // No-op if record already doesn't exist
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
      })
    },
  })
}
