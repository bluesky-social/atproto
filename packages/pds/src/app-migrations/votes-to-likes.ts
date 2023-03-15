import { cborBytesToRecord, chunkArray } from '@atproto/common'
import { sql } from 'kysely'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ids } from '../lexicon/lexicons'
import { prepareCreate, prepareDelete, assertValidRecord } from '../repo'
import { RepoService } from '../services/repo'

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
  // but that has been taken care of via a db migration to remove the indexes entirely.
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
  const createsTurnedDeletes: string[] = []
  const chunks = chunkArray(didsWithVotes, Math.ceil(didsWithVotes.length / 5))

  await Promise.all(
    chunks.map(async (dids) => {
      for (const did of dids) {
        const votes = await getVotes(tx, did)
        console.log(SHORT_NAME, `${did} processing ${votes.length} votes`)

        const writeResults = await Promise.all(
          votes.map(async (vote) => {
            const record = cborBytesToRecord(vote.bytes)
            const del = prepareDelete({
              did,
              collection: VOTE_LEX_ID,
              rkey: vote.rkey,
            })

            if (record.direction !== 'up') {
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
          await repoTx.processWrites(did, writeChunk.flat(), now)
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

  if (createsTurnedDeletes.length > voteCount / 1000) {
    throw new Error('Too many creates-turned-deletes.')
  }

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

  console.log(
    SHORT_NAME,
    'complete in',
    (Date.now() - new Date(now).getTime()) / 1000,
    'sec',
  )
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
    .select(sql`count(*)`.as('count'))
    .where('collection', '=', VOTE_LEX_ID)
    .executeTakeFirstOrThrow()
  return Number(count)
}
