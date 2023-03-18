import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import {
  InvalidRecordError,
  PreparedCreate,
  prepareDelete,
} from '../../../../repo'
import AppContext from '../../../../context'
import { ids } from '../../../../lexicon/lexicons'
import Database from '../../../../db'
import SqlRepoStorage from '../../../../sql-repo-storage'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.createRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, record, swapCommit, validate } = input.body
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      // determine key type. if undefined, repo assigns a TID
      const rkey = repo.determineRkey(collection)

      const now = new Date().toISOString()
      let write: PreparedCreate
      try {
        write = await repo.prepareCreate({
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

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        const storage = new SqlRepoStorage(dbTxn, did, now)
        const pinned = await storage.getPinnedAtHead()
        if (swapCommit && swapCommit !== pinned.head?.toString()) {
          throw new InvalidRequestError(
            `Commit was at ${pinned.head?.toString() ?? 'null'}`,
            'InvalidSwap',
          )
        }
        const backlinkDeletions = validate
          ? await getBacklinkDeletions(dbTxn, ctx, write)
          : []
        await repoTxn.processWrites(
          did,
          [...backlinkDeletions, write],
          now,
          pinned,
        )
      })

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })
}

// @NOTE this logic a placeholder until we allow users to specify these constraints themselves.
// Ensures that we don't end-up with duplicate likes, reposts, and follows from race conditions.

async function getBacklinkDeletions(
  tx: Database,
  ctx: AppContext,
  write: PreparedCreate,
) {
  tx.assertTransaction()
  const recordTxn = ctx.services.record(tx)
  const {
    record,
    uri: { host: did, collection },
  } = write
  const toDelete = ({ rkey }: { rkey: string }) =>
    prepareDelete({ did, collection, rkey })

  if (
    collection === ids.AppBskyGraphFollow &&
    typeof record['subject'] === 'string'
  ) {
    const backlinks = await recordTxn.getRecordBacklinks({
      did,
      collection,
      path: 'subject',
      linkTo: record['subject'],
    })
    return backlinks.map(toDelete)
  }

  if (
    (collection === ids.AppBskyFeedLike ||
      collection === ids.AppBskyFeedRepost) &&
    typeof record['subject']?.['uri'] === 'string'
  ) {
    const backlinks = await recordTxn.getRecordBacklinks({
      did,
      collection,
      path: 'subject.uri',
      linkTo: record['subject']['uri'],
    })
    return backlinks.map(toDelete)
  }

  return []
}
