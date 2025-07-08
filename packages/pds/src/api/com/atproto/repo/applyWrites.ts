import { CID } from 'multiformats/cid'
import { WriteOpAction } from '@atproto/repo'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  CreateResult,
  DeleteResult,
  HandlerInput,
  UpdateResult,
  isCreate,
  isDelete,
  isUpdate,
} from '../../../../lexicon/types/com/atproto/repo/applyWrites'
import { dbLogger } from '../../../../logger'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../../../repo'

const ratelimitPoints = ({ input }: { input: HandlerInput }) => {
  let points = 0
  for (const op of input.body.writes) {
    if (isCreate(op)) {
      points += 3
    } else if (isUpdate(op)) {
      points += 2
    } else {
      points += 1
    }
  }
  return points
}

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.applyWrites({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
    }),

    rateLimit: [
      {
        name: 'repo-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: ratelimitPoints,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: ratelimitPoints,
      },
    ],

    handler: async ({ input, auth }) => {
      const { repo, validate, swapCommit, writes } = input.body

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
      if (writes.length > 200) {
        throw new InvalidRequestError('Too many writes. Max: 200')
      }

      // Verify permission of every unique "action" / "collection" pair
      for (const [action, collections] of [
        ['create', new Set(writes.filter(isCreate).map((w) => w.collection))],
        ['update', new Set(writes.filter(isUpdate).map((w) => w.collection))],
        ['delete', new Set(writes.filter(isDelete).map((w) => w.collection))],
      ] as const) {
        for (const collection of collections) {
          auth.credentials.permissions.assertRepo({ action, collection })
        }
      }

      // @NOTE should preserve order of ts.writes for final use in response
      let preparedWrites: PreparedWrite[]
      try {
        preparedWrites = await Promise.all(
          writes.map(async (write) => {
            if (isCreate(write)) {
              return prepareCreate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (isUpdate(write)) {
              return prepareUpdate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (isDelete(write)) {
              return prepareDelete({
                did,
                collection: write.collection,
                rkey: write.rkey,
              })
            } else {
              throw new InvalidRequestError(
                `Action not supported: ${write['$type']}`,
              )
            }
          }),
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      const swapCommitCid = swapCommit ? CID.parse(swapCommit) : undefined

      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const commit = await actorTxn.repo
          .processWrites(preparedWrites, swapCommitCid)
          .catch((err) => {
            if (err instanceof BadCommitSwapError) {
              throw new InvalidRequestError(err.message, 'InvalidSwap')
            } else {
              throw err
            }
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
          commit: {
            cid: commit.cid.toString(),
            rev: commit.rev,
          },
          results: preparedWrites.map(writeToOutputResult),
        },
      }
    },
  })
}

const writeToOutputResult = (write: PreparedWrite) => {
  switch (write.action) {
    case WriteOpAction.Create:
      return {
        $type: 'com.atproto.repo.applyWrites#createResult',
        cid: write.cid.toString(),
        uri: write.uri.toString(),
        validationStatus: write.validationStatus,
      } satisfies CreateResult
    case WriteOpAction.Update:
      return {
        $type: 'com.atproto.repo.applyWrites#updateResult',
        cid: write.cid.toString(),
        uri: write.uri.toString(),
        validationStatus: write.validationStatus,
      } satisfies UpdateResult
    case WriteOpAction.Delete:
      return {
        $type: 'com.atproto.repo.applyWrites#deleteResult',
      } satisfies DeleteResult
    default:
      throw new Error(`Unrecognized action: ${write}`)
  }
}
