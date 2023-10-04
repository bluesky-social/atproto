import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { prepareCreate, prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedCreate,
} from '../../../../repo'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.createRecord({
    auth: ctx.accessVerifierCheckTakedown,
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
      const did = await ctx.services.account(ctx.db).getDidForActor(repo)

      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
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
        throw err
      }

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const backlinkConflicts = validate
          ? await actorTxn.record.getBacklinkConflicts(write.uri, write.record)
          : []
        const backlinkDeletions = backlinkConflicts.map((uri) =>
          prepareDelete({
            did: uri.hostname,
            collection: uri.collection,
            rkey: uri.rkey,
          }),
        )
        const writes = [...backlinkDeletions, write]
        try {
          await actorTxn.repo.processWrites(writes, swapCommitCid)
        } catch (err) {
          if (err instanceof BadCommitSwapError) {
            throw new InvalidRequestError(err.message, 'InvalidSwap')
          }
          throw err
        }
      })

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })
}
