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
    auth: ctx.authVerifier.authorization({
      // @NOTE the "checkTakedown" and "checkDeactivated" checks are typically
      // performed during auth. However, since this method's "repo" parameter
      // can be a handle, we will need to fetch the account again to ensure that
      // the handle matches the DID from the request's credentials. In order to
      // avoid fetching the account twice (during auth, and then again in the
      // controller), the checks are disabled here:

      // checkTakedown: true,
      // checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
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

      const account = await ctx.authVerifier.findAccount(repo, {
        checkDeactivated: true,
        checkTakedown: true,
      })

      const did = account.did
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      // We can't compute permissions based on the request payload ("input") in
      // the 'auth' phase, so we do it here.
      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertRepo({
          action: 'delete',
          collection,
        })
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
