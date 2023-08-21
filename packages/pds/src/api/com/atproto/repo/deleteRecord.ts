import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { BadCommitSwapError, BadRecordSwapError } from '../../../../repo'
import { CID } from 'multiformats/cid'
import { ConcurrentWriteError } from '../../../../services/repo'

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

      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid = swapRecord ? CID.parse(swapRecord) : undefined

      const write = prepareDelete({
        did,
        collection,
        rkey,
        swapCid: swapRecordCid,
      })
      const record = await ctx.services
        .record(ctx.db)
        .getRecord(write.uri, null, true)
      if (!record) {
        return // No-op if record already doesn't exist
      }

      const writes = [write]

      try {
        await ctx.services
          .repo(ctx.db)
          .processWrites({ did, writes, swapCommitCid }, 10)
      } catch (err) {
        if (
          err instanceof BadCommitSwapError ||
          err instanceof BadRecordSwapError
        ) {
          throw new InvalidRequestError(err.message, 'InvalidSwap')
        } else if (err instanceof ConcurrentWriteError) {
          throw new InvalidRequestError(err.message, 'ConcurrentWrites')
        } else {
          throw err
        }
      }
    },
  })
}
