import { CID } from 'multiformats/cid'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { dbLogger } from '../../../../logger'
import {
  BadCommitSwapError,
  BadRecordSwapError,
  prepareDelete,
} from '../../../../repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.deleteRecord({
    auth: ctx.authVerifier.accessStandard({
      checkTakedown: true,
      checkDeactivated: true,
    }),
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
      const account = await ctx.accountManager.getAccount(repo, {
        includeDeactivated: true,
      })

      if (!account) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      } else if (account.deactivatedAt) {
        throw new InvalidRequestError('Account is deactivated')
      }
      const did = account.did
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

        const commit = await actorTxn.repo
          .processWrites([write], swapCommitCid)
          .catch((err) => {
            if (
              err instanceof BadCommitSwapError ||
              err instanceof BadRecordSwapError
            ) {
              throw new InvalidRequestError(err.message, 'InvalidSwap')
            } else {
              throw err
            }
          })

        await ctx.sequencer.sequenceCommit(did, commit)
        return commit
      })

      if (commit !== null) {
        await ctx.accountManager
          .updateRepoRoot(did, commit.cid, commit.rev)
          .catch((err) => {
            dbLogger.error(
              { err, did, cid: commit.cid, rev: commit.rev },
              'failed to update account root',
            )
          })
      }

      return {
        encoding: 'application/json',
        body: {
          commit: commit
            ? {
                cid: commit.cid.toString(),
                rev: commit.rev,
              }
            : undefined,
        },
      }
    },
  })
}
