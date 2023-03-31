import assert from 'assert'
import { sql } from 'kysely'
import { cborBytesToRecord, chunkArray } from '@atproto/common'
import { cborToLexRecord } from '@atproto/repo'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ids } from '../lexicon/lexicons'
import { prepareCreate, prepareDelete, assertValidRecord } from '../repo'
import { RepoService } from '../services/repo'
import { countAll } from '../db/util'

const MIGRATION_NAME = '2023-03-15-votes-to-likes'
const SHORT_NAME = 'votes-to-likes'
const VOTE_LEX_ID = 'app.bsky.feed.vote'

export async function votesToLikesMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(tx, ctx))
}

async function main(tx: Database, ctx: AppContext) {
  console.log(SHORT_NAME, 'beginning')
  tx.assertTransaction()
  const { ref } = tx.db.dynamic
  const now = new Date().toISOString()

  // The message dispatcher usually ensures that the app view indexes these updates,
  // but that has been taken care of with a db migration, plus the end of this migration.
  const noopDispatcher = new MessageDispatcher()
  noopDispatcher.destroy()

  const repoTx = new RepoService(
    tx,
    ctx.repoSigningKey,
    noopDispatcher,
    ctx.blobstore,
  )

  // For each user remove vote records and replace with new like records.

  const [didsWithVotes, voteCount] = await Promise.all([
    getDidsWithVotes(tx),
    getVoteCount(tx),
  ])

  console.log(
    SHORT_NAME,
    `${voteCount} votes across ${didsWithVotes.length} dids`,
  )

  let didsComplete = 0
  let votesComplete = 0
  let processedDownvotes = 0
  const createsTurnedDeletes: string[] = []
  const chunks = chunkArray(didsWithVotes, Math.ceil(didsWithVotes.length / 10))

  await Promise.all(
    chunks.map(async (dids) => {
      for (const did of dids) {
        const votes = await getVotes(tx, did)
        console.log(SHORT_NAME, `${did} processing ${votes.length} votes`)

        const writeResults = await Promise.all(
          votes.map(async (vote) => {
            const record = cborToLexRecord(vote.bytes)
            const del = prepareDelete({
              did,
              collection: VOTE_LEX_ID,
              rkey: vote.rkey,
            })

            if (record.direction !== 'up') {
              processedDownvotes++
              return del // Delete downvotes
            }

            try {
              record['$type'] = ids.AppBskyFeedLike
              delete record['direction']
              assertValidRecord(record)
            } catch {
              // Delete invalid votes that can't be mapped to a like
              createsTurnedDeletes.push(del.uri.toString())
              return del
            }

            // Delete vote and replace it with a valid like record
            return [
              del,
              await prepareCreate({
                did,
                collection: ids.AppBskyFeedLike,
                rkey: vote.rkey, // Maintain same rkey
                record,
                validate: false, // Validated above
              }),
            ]
          }),
        )

        // Chunk to avoid hitting e.g. postgres param limits
        for (const writeChunk of chunkArray(writeResults, 1000)) {
          const writes = writeChunk.flat()
          if (writes.length) {
            await repoTx.processWrites(did, writes, now)
          }
        }

        didsComplete += 1
        votesComplete += votes.length
        console.log(
          SHORT_NAME,
          `(${didsComplete}/${didsWithVotes.length}) dids, (${votesComplete}/${voteCount}) records`,
        )
      }
    }),
  )

  console.log(
    SHORT_NAME,
    `${createsTurnedDeletes.length} creates-turned-deletes`,
    createsTurnedDeletes,
  )

  // Update indexes for deleted, invalid votes

  if (createsTurnedDeletes.length) {
    await tx.db
      .deleteFrom('like')
      .where('uri', 'in', createsTurnedDeletes)
      .executeTakeFirst()
    await tx.db
      .deleteFrom('duplicate_record')
      .where('duplicateOf', 'in', createsTurnedDeletes)
      .executeTakeFirst()
  }

  console.log(SHORT_NAME, 'updated indexes for creates-turned-deletes')

  // Updating uris in index
  console.log(SHORT_NAME, 'updating uris in index')

  const updatedUris = await tx.db
    .updateTable('like')
    .set({
      uri: sql`replace(uri, ${`/${VOTE_LEX_ID}/`}, ${`/${ids.AppBskyFeedLike}/`})`,
    })
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `updated ${Number(updatedUris.numUpdatedRows)} like uris in index`,
  )

  // Update uris and cids in indexed likes.

  console.log(SHORT_NAME, 'updating like cids in index')

  const recordForLikeQb = tx.db
    .selectFrom('record')
    .whereRef('uri', '=', ref('like.uri'))
  const updatedCids = await tx.db
    .updateTable('like')
    .whereExists(recordForLikeQb.selectAll())
    .set({ cid: recordForLikeQb.select('cid') })
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `updated ${Number(updatedCids.numUpdatedRows)} like cids in index`,
  )

  console.log(SHORT_NAME, 'running dummy check')
  await dummyCheck(tx, {
    voteCount,
    deleteInvalidCount: createsTurnedDeletes.length,
    deleteDownvoteCount: processedDownvotes,
  })

  console.log(
    SHORT_NAME,
    'complete in',
    (Date.now() - Date.parse(now)) / 1000,
    'sec',
  )
}

async function dummyCheck(
  db: Database,
  original: {
    voteCount: number
    deleteInvalidCount: number
    deleteDownvoteCount: number
  },
) {
  // Check 1: rogue deletions
  assert(
    original.deleteInvalidCount < original.voteCount / 1000,
    `${SHORT_NAME} dummy check failed: too many creates-turned-deletes.`,
  )

  // Check 2: record index size reflects creates/deletes
  const { likeCount } = await db.db
    .selectFrom('record')
    .where('collection', '=', ids.AppBskyFeedLike)
    .select(countAll.as('likeCount'))
    .executeTakeFirstOrThrow()
  const { voteCount } = await db.db
    .selectFrom('record')
    .where('collection', '=', VOTE_LEX_ID)
    .select(countAll.as('voteCount'))
    .executeTakeFirstOrThrow()
  assert(
    voteCount === 0,
    `${SHORT_NAME} dummy check failed: ${voteCount} votes remain`,
  )
  console.log(
    SHORT_NAME,
    'dummy count',
    likeCount,
    'from',
    original.voteCount -
      original.deleteInvalidCount -
      original.deleteDownvoteCount,
    original,
  )
  /** Not appropriate for live migration
   *  assert(
   *    likeCount ===
   *      original.voteCount -
   *        original.deleteInvalidCount -
   *        original.deleteDownvoteCount,
   *    `${SHORT_NAME} dummy check failed: ${likeCount} likes doesn't match ${JSON.stringify(
   *      original,
   *    )}`,
   *  )
   */

  // Check 3. like index
  const { indexMismatchedCount } = await db.db
    .selectFrom('like')
    .innerJoin('record', 'record.uri', 'like.uri')
    .whereRef('like.cid', '!=', 'record.cid')
    .orWhere('record.collection', '!=', ids.AppBskyFeedLike)
    .select(countAll.as('indexMismatchedCount'))
    .executeTakeFirstOrThrow()
  assert(
    indexMismatchedCount === 0,
    `${SHORT_NAME} dummy check failed: ${indexMismatchedCount} mismatched records from like index`,
  )

  // Check 4: record cids and content
  const pct = Math.min(50 / likeCount, 1) // Aim for around 50 random tests cases
  const testCases = await db.db
    .selectFrom('record')
    .leftJoin('ipld_block', (join) =>
      join
        .onRef('ipld_block.cid', '=', 'record.cid')
        .onRef('ipld_block.creator', '=', 'record.did'),
    )
    .where('collection', '=', ids.AppBskyFeedLike)
    .where(sql`random()`, '<', pct)
    .select(['uri', 'ipld_block.content as bytes'])
    .execute()

  console.log(`${SHORT_NAME} dummy check ${testCases.length} test cases`)

  for (const { uri, bytes } of testCases) {
    assert(bytes, `${SHORT_NAME} dummy check failed: ${uri} missing bytes`)
    const record = cborBytesToRecord(bytes)
    assert(
      record['$type'] === ids.AppBskyFeedLike,
      `${SHORT_NAME} dummy check failed: ${uri} bad record type`,
    )
    try {
      assertValidRecord(record)
    } catch {
      throw new Error(`${SHORT_NAME} dummy check failed: ${uri} invalid record`)
    }
  }
}

async function getDidsWithVotes(db: Database) {
  const res = await db.db
    .selectFrom('record')
    .select('did')
    .where('collection', '=', VOTE_LEX_ID)
    .groupBy('did')
    .execute()
  return res.map((row) => row.did)
}

async function getVotes(db: Database, did: string) {
  return await db.db
    .selectFrom('record')
    .where('did', '=', did)
    .where('collection', '=', VOTE_LEX_ID)
    .innerJoin('ipld_block', (join) =>
      join
        .onRef('ipld_block.cid', '=', 'record.cid')
        .on('ipld_block.creator', '=', did),
    )
    .select(['ipld_block.content as bytes', 'rkey'])
    .execute()
}

async function getVoteCount(db: Database) {
  const { count } = await db.db
    .selectFrom('record')
    .select(countAll.as('count'))
    .where('collection', '=', VOTE_LEX_ID)
    .executeTakeFirstOrThrow()
  return Number(count)
}
