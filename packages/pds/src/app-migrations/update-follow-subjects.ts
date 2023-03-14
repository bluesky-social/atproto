import { cborBytesToRecord, chunkArray } from '@atproto/common'
import { sql } from 'kysely'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ids } from '../lexicon/lexicons'
import { prepareUpdate } from '../repo'
import { RepoService } from '../services/repo'

const MIGRATION_NAME = '2023-03-14-update-follow-subjects'
const SHORT_NAME = 'update-follow-subjects'

export async function updateFollowSubjectsMigration(ctx: AppContext) {
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

  // For each user update follow records.

  const [dids, followCount] = await Promise.all([
    getActorDids(tx),
    getFollowCount(tx),
  ])
  const chunks = chunkArray(dids, Math.ceil(dids.length / 2))

  console.log(SHORT_NAME, `${followCount} updates across ${dids.length} dids`)
  let didsComplete = 0
  let updatesComplete = 0

  await Promise.all(
    chunks.map(async (dids) => {
      for (const did of dids) {
        const follows = await getFollows(tx, did)
        console.log(SHORT_NAME, `${did} processing ${follows.length} updates`)

        const updates = await Promise.all(
          follows.map((follow) => {
            const record = cborBytesToRecord(follow.bytes)
            if (typeof record['subject']?.['did'] === 'string') {
              // Map old app.bsky.actor.ref to did
              record['subject'] = record['subject']['did']
            }
            return prepareUpdate({
              did,
              collection: ids.AppBskyGraphFollow,
              rkey: follow.rkey,
              record,
            })
          }),
        )

        await repoTx.processWrites(did, updates, now)

        didsComplete += 1
        updatesComplete += follows.length
        console.log(
          SHORT_NAME,
          `(${didsComplete}/${dids.length}) dids, (${updatesComplete}/${followCount}) records`,
        )
      }
    }),
  )

  // Update cids on indexed follows.

  console.log(SHORT_NAME, 'updating follow cids in index')

  const recordForFollowQb = tx.db
    .selectFrom('record')
    .whereRef('uri', '=', ref('follow.uri'))
  const updated = await tx.db
    .updateTable('follow')
    .whereExists(recordForFollowQb.selectAll())
    .set({ cid: recordForFollowQb.select('cid') })
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `updated ${Number(updated.numUpdatedRows)} follow cids in index`,
  )

  console.log(SHORT_NAME, 'complete')
}

async function getActorDids(db: Database) {
  const res = await db.db.selectFrom('did_handle').select('did').execute()
  return res.map((row) => row.did)
}

async function getFollows(db: Database, did: string) {
  return await db.db
    .selectFrom('record')
    .where('did', '=', did)
    .where('collection', '=', ids.AppBskyGraphFollow)
    .innerJoin('ipld_block', (join) =>
      join
        .onRef('ipld_block.cid', '=', 'record.cid')
        .on('ipld_block.creator', '=', did),
    )
    .select(['ipld_block.content as bytes', 'rkey'])
    .execute()
}

async function getFollowCount(db: Database) {
  const { count } = await db.db
    .selectFrom('record')
    .select(sql`count(*)`.as('count'))
    .where('collection', '=', ids.AppBskyGraphFollow)
    .executeTakeFirstOrThrow()
  return Number(count)
}
