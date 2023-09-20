import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { prepareCreate, prepareDelete, prepareUpdate } from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  HandlerInput,
  isCreate,
  isUpdate,
  isDelete,
} from '../../../../lexicon/types/com/atproto/repo/applyWrites'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedWrite,
} from '../../../../repo'
import AppContext from '../../../../context'
import { ConcurrentWriteError } from '../../../../services/repo'

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
    auth: ctx.accessVerifierCheckTakedown,
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
      const tx = input.body
      const { repo, validate, swapCommit } = tx
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
      if (tx.writes.length > 200) {
        throw new InvalidRequestError('Too many writes. Max: 200')
      }

      let writes: PreparedWrite[]
      try {
        writes = await Promise.all(
          tx.writes.map((write) => {
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

      try {
        await ctx.services
          .repo(ctx.db)
          .processWrites({ did, writes, swapCommitCid }, 10)
      } catch (err) {
        if (err instanceof BadCommitSwapError) {
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
