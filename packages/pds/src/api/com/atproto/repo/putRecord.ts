import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { CommitData } from '@atproto/repo'
import { Server } from '../../../../lexicon'
import { prepareUpdate, prepareCreate } from '../../../../repo'
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
    auth: ctx.authVerifier.accessCheckTakedown,
    rateLimit: [
      {
        name: 'repo-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 2,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 2,
      },
    ],
    handler: async ({ auth, input }) => {
      const {
        repo,
        collection,
        rkey,
        record,
        validate,
        swapCommit,
        swapRecord,
      } = input.body
      const did = await ctx.accountManager.getDidForActor(repo)

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

      const uri = AtUri.make(did, collection, rkey)
      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined
      const swapRecordCid =
        typeof swapRecord === 'string' ? CID.parse(swapRecord) : swapRecord

      const { commit, write } = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          const current = await actorTxn.record.getRecord(uri, null, true)
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
              ? await prepareUpdate(writeInfo)
              : await prepareCreate(writeInfo)
          } catch (err) {
            if (err instanceof InvalidRecordError) {
              throw new InvalidRequestError(err.message)
            }
            throw err
          }

          // no-op
          if (current && current.cid === write.cid.toString()) {
            return {
              commit: null,
              write,
            }
          }

          let commit: CommitData
          try {
            commit = await actorTxn.repo.processWrites([write], swapCommitCid)
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
          return { commit, write }
        },
      )

      if (commit !== null) {
        await ctx.sequencer.sequenceCommit(did, commit, [write])
        await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
      }

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
