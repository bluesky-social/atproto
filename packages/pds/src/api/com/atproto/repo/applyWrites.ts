import { parseCid } from '@atproto/lex-data'
import { WriteOpAction } from '@atproto/repo'
import {
  AuthRequiredError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { dbLogger } from '../../../../logger'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
} from '../../../../repo'

const ratelimitPoints = ({
  input,
}: {
  input: com.atproto.repo.applyWrites.Input
}) => {
  let points = 0
  for (const op of input.body.writes) {
    if (com.atproto.repo.applyWrites.create.$isTypeOf(op)) {
      points += 3
    } else if (com.atproto.repo.applyWrites.update.$isTypeOf(op)) {
      points += 2
    } else {
      points += 1
    }
  }
  return points
}

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.applyWrites, {
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
        // Performed in the handler as it is based on the request body
      },
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

      const account = await ctx.authVerifier.findAccount(repo, {
        checkDeactivated: true,
        checkTakedown: true,
      })

      const did = account.did
      if (did !== auth.credentials.did) {
        throw new AuthRequiredError()
      }

      if (writes.length > 200) {
        throw new InvalidRequestError('Too many writes. Max: 200')
      }

      // Verify permission of every unique "action" / "collection" pair
      if (auth.credentials.type === 'oauth') {
        // @NOTE Unlike "importRepo", we do not require "action" = "*" here.
        for (const [action, collections] of [
          [
            'create',
            new Set(
              writes
                .filter((v) => com.atproto.repo.applyWrites.create.$isTypeOf(v))
                .map((w) => w.collection),
            ),
          ],
          [
            'update',
            new Set(
              writes
                .filter((v) => com.atproto.repo.applyWrites.update.$isTypeOf(v))
                .map((w) => w.collection),
            ),
          ],
          [
            'delete',
            new Set(
              writes
                .filter((v) => com.atproto.repo.applyWrites.delete.$isTypeOf(v))
                .map((w) => w.collection),
            ),
          ],
        ] as const) {
          for (const collection of collections) {
            auth.credentials.permissions.assertRepo({ action, collection })
          }
        }
      }

      // @NOTE should preserve order of ts.writes for final use in response
      let preparedWrites: PreparedWrite[]
      try {
        preparedWrites = await Promise.all(
          writes.map(async (write) => {
            if (com.atproto.repo.applyWrites.create.$isTypeOf(write)) {
              return prepareCreate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (com.atproto.repo.applyWrites.update.$isTypeOf(write)) {
              return prepareUpdate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (com.atproto.repo.applyWrites.delete.$isTypeOf(write)) {
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

      const swapCommitCid = swapCommit ? parseCid(swapCommit) : undefined

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
        encoding: 'application/json' as const,
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
      return com.atproto.repo.applyWrites.createResult.$build({
        cid: write.cid.toString(),
        uri: write.uri.toString(),
        validationStatus: write.validationStatus,
      })
    case WriteOpAction.Update:
      return com.atproto.repo.applyWrites.updateResult.$build({
        cid: write.cid.toString(),
        uri: write.uri.toString(),
        validationStatus: write.validationStatus,
      })
    case WriteOpAction.Delete:
      return com.atproto.repo.applyWrites.deleteResult.$build({})
    default:
      throw new Error(`Unrecognized action: ${write}`)
  }
}
