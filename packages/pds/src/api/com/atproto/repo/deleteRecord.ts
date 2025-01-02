import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { prepareDelete } from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { BadCommitSwapError, BadRecordSwapError } from '../../../../repo'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'

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

      const uri = AtUri.make(did, collection, rkey)
      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const record = await actorTxn.record.getRecord(uri, null, true)
        if (!record) {
          return null // No-op if record already doesn't exist
        }
        const write = prepareDelete({
          did,
          collection,
          rkey,
          swapCid: CID.parse(record.cid),
        })

        try {
          const commit = await actorTxn.repo.processWrites(
            [write],
            swapCommitCid,
          )
          return { commit, write }
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

      if (result) {
        const { commit, write } = result
        await ctx.sequencer.sequenceCommit(did, commit, [write])
        await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
      }
      return {
        encoding: 'application/json',
        body: {
          commit: result?.commit
            ? {
                cid: result.commit.cid.toString(),
                rev: result.commit.rev,
              }
            : undefined,
        },
      }
    },
  })
}
