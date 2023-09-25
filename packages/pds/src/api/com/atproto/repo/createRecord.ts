import { CID } from 'multiformats/cid'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { prepareCreate } from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  BadCommitSwapError,
  InvalidRecordError,
  PreparedCreate,
} from '../../../../repo'
import AppContext from '../../../../context'
import { ids } from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import { ConcurrentWriteError } from '../../../../services/repo'
import { AtUri } from '@atproto/syntax'

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

      const existing = validate
        ? await getExistingBacklink(ctx.db, ctx, write)
        : null
      if (existing) {
        return {
          encoding: 'application/json',
          body: { uri: existing.uri.toString(), cid: existing.cid.toString() },
        }
      }

      try {
        await ctx.services
          .repo(ctx.db)
          .processWrites({ did, writes: [write], swapCommitCid }, 10)
      } catch (err) {
        if (err instanceof BadCommitSwapError) {
          throw new InvalidRequestError(err.message, 'InvalidSwap')
        } else if (err instanceof ConcurrentWriteError) {
          throw new InvalidRequestError(err.message, 'ConcurrentWrites')
        }
        throw err
      }

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })
}

// @NOTE this logic a placeholder until we allow users to specify these constraints themselves.
// Ensures that we don't end-up with duplicate likes, reposts, and follows from race conditions.

async function getExistingBacklink(
  tx: Database,
  ctx: AppContext,
  write: PreparedCreate,
): Promise<{ uri: AtUri; cid: CID } | null> {
  const recordTxn = ctx.services.record(tx)
  const {
    record,
    uri: { host: did, collection },
  } = write

  if (
    (collection === ids.AppBskyGraphFollow ||
      collection === ids.AppBskyGraphBlock) &&
    typeof record['subject'] === 'string'
  ) {
    return recordTxn.getExistingBacklink({
      did,
      collection,
      path: 'subject',
      linkTo: record['subject'],
    })
  }

  if (
    (collection === ids.AppBskyFeedLike ||
      collection === ids.AppBskyFeedRepost) &&
    typeof record['subject']?.['uri'] === 'string'
  ) {
    return recordTxn.getExistingBacklink({
      did,
      collection,
      path: 'subject.uri',
      linkTo: record['subject']['uri'],
    })
  }

  return null
}
