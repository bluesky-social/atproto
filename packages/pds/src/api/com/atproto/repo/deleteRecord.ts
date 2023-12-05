import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { BadCommitSwapError, BadRecordSwapError } from '../../../../repo'
import { CID } from 'multiformats/cid'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.deleteRecord({
    auth: ctx.authVerifier.accessCheckTakedown,
    rateLimit: [
      {
        name: 'repo-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 1,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 1,
      },
    ],
    handler: async ({ input, auth }) => {
      const { repo, collection, rkey, swapCommit, swapRecord } = input.body
      const did = await ctx.accountManager.getDidForActor(repo)

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
      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const record = await actorTxn.record.getRecord(write.uri, null, true)
        if (!record) {
          return null // No-op if record already doesn't exist
        }
        try {
          return await actorTxn.repo.processWrites([write], swapCommitCid)
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

      if (commit !== null) {
        await ctx.sequencer.sequenceCommit(did, commit, [write])
        await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
      }
    },
  })
}
