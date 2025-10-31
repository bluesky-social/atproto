import { CID } from 'multiformats/cid'
import { InvalidRecordKeyError } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { dbLogger } from '../../../../logger'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedCreate,
  prepareCreate,
  prepareDelete,
} from '../../../../repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.createRecord({
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
        calcPoints: () => 3,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 3,
      },
    ],
    handler: async ({ input, auth }) => {
      const { repo, collection, rkey, record, swapCommit, validate } =
        input.body

      const account = await ctx.authVerifier.findAccount(repo, {
        checkDeactivated: true,
        checkTakedown: true,
      })

      const did = account.did
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      if (auth.credentials.type === 'oauth') {
        auth.credentials.permissions.assertRepo({
          action: 'create',
          collection,
        })
      }

      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined

      let write: PreparedCreate
      try {
        write = await prepareCreate({
          did,
          collection,
          record,
          rkey,
          validate,
        })
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        if (err instanceof InvalidRecordKeyError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const backlinkConflicts =
          validate !== false
            ? await actorTxn.record.getBacklinkConflicts(
                write.uri,
                write.record,
              )
            : []
        const backlinkDeletions = backlinkConflicts.map((uri) =>
          prepareDelete({
            did: uri.hostname,
            collection: uri.collection,
            rkey: uri.rkey,
          }),
        )
        const writes = [...backlinkDeletions, write]
        const commit = await actorTxn.repo
          .processWrites(writes, swapCommitCid)
          .catch((err) => {
            if (err instanceof BadCommitSwapError) {
              throw new InvalidRequestError(err.message, 'InvalidSwap')
            }
            throw err
          })
        await ctx.sequencer.sequenceCommit(did, commit)
        return commit
      })

      await ctx.accountManager
        .updateRepoRoot(did, commit.cid, commit.rev)
        .catch((err) => {
          dbLogger.error(
            { err, did, cid: commit.cid, rev: commit.rev },
            'failed to update account root',
          )
        })

      return {
        encoding: 'application/json',
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
          commit: {
            cid: commit.cid.toString(),
            rev: commit.rev,
          },
          validationStatus: write.validationStatus,
        },
      }
    },
  })
}
