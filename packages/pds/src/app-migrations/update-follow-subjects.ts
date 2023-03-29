import assert from 'assert'
import { sql } from 'kysely'
import { cborBytesToRecord, chunkArray } from '@atproto/common'
import { cborToLexRecord } from '@atproto/repo'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { countAll } from '../db/util'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ids } from '../lexicon/lexicons'
import { prepareUpdate, prepareDelete, assertValidRecord } from '../repo'
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

  const [allDids, followCount] = await Promise.all([
    getAllDids(tx),
    getFollowCount(tx),
  ])

  console.log(
    SHORT_NAME,
    `${followCount} updates across ${allDids.length} dids`,
  )

  let didsComplete = 0
  let updatesComplete = 0
  let sceneDeleteCount = 0
  const updatesTurnedDeletes: string[] = []
  const chunks = chunkArray(allDids, Math.ceil(allDids.length / 20))

  await Promise.all(
    chunks.map(async (dids) => {
      for (const did of dids) {
        const follows = await getFollows(tx, did)
        console.log(SHORT_NAME, `${did} processing ${follows.length} updates`)

        const updates = await Promise.all(
          follows.map((follow) => {
            const record = cborToLexRecord(follow.bytes)
            if (typeof record['subject']?.['did'] === 'string') {
              // Map old app.bsky.actor.ref to did
              record['subject'] = record['subject']['did']
            }
            try {
              assertValidRecord(record)
              if (sceneDids.has(record['subject'] as string)) {
                sceneDeleteCount += 1
                throw new Error('Follow was for scene')
              }
            } catch {
              const del = prepareDelete({
                did,
                collection: ids.AppBskyGraphFollow,
                rkey: follow.rkey,
              })
              updatesTurnedDeletes.push(del.uri.toString())
              return del
            }
            return prepareUpdate({
              did,
              collection: ids.AppBskyGraphFollow,
              rkey: follow.rkey,
              record,
              validate: false, // Validated above
            })
          }),
        )

        if (updates.length) {
          await repoTx.processWrites(did, updates, now)
        }

        didsComplete += 1
        updatesComplete += follows.length
        console.log(
          SHORT_NAME,
          `(${didsComplete}/${allDids.length}) dids, (${updatesComplete}/${followCount}) records`,
        )
      }
    }),
  )

  console.log(
    SHORT_NAME,
    `${updatesTurnedDeletes.length} updates-turned-deletes`,
    updatesTurnedDeletes,
  )

  // Update indexes for deleted, invalid follows

  if (updatesTurnedDeletes.length) {
    await tx.db
      .deleteFrom('follow')
      .where('uri', 'in', updatesTurnedDeletes)
      .executeTakeFirst()
    await tx.db
      .deleteFrom('duplicate_record')
      .where('duplicateOf', 'in', updatesTurnedDeletes)
      .executeTakeFirst()
  }

  console.log(SHORT_NAME, 'updated indexes for updates-turned-deletes')

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

  console.log(SHORT_NAME, 'running dummy check')
  await dummyCheck(tx, {
    followCount,
    sceneDeleteCount,
    deleteCount: updatesTurnedDeletes.length,
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
    followCount: number
    deleteCount: number
    sceneDeleteCount: number
  },
) {
  // Check 1: rogue deletions
  assert(
    original.deleteCount - original.sceneDeleteCount <
      original.followCount / 1000,
    `${SHORT_NAME} dummy check failed: too many updates-turned-deletes.`,
  )

  // Check 2: record index size reflects updates/deletes
  const { followCount } = await db.db
    .selectFrom('record')
    .where('collection', '=', ids.AppBskyGraphFollow)
    .select(countAll.as('followCount'))
    .executeTakeFirstOrThrow()
  console.log(
    SHORT_NAME,
    'dummy count',
    followCount,
    'from',
    original.followCount - original.deleteCount,
    original,
  )
  /** Not appropriate for live migration
   *  assert(
   *    followCount === original.followCount - original.deleteCount,
   *    `${SHORT_NAME} dummy check failed: ${followCount} follows doesn't match ${JSON.stringify(
   *      original,
   *    )}`,
   *  )
   */

  // Check 3. follow index
  const { indexMismatchedCount } = await db.db
    .selectFrom('follow')
    .innerJoin('record', 'record.uri', 'follow.uri')
    .whereRef('follow.cid', '!=', 'record.cid')
    .select(countAll.as('indexMismatchedCount'))
    .executeTakeFirstOrThrow()
  assert(
    indexMismatchedCount === 0,
    `${SHORT_NAME} dummy check failed: ${indexMismatchedCount} mismatched records from follow index`,
  )

  // Check 4: cids and content
  const pct = Math.min(50 / followCount, 1) // Aim for around 50 random tests cases
  const testCases = await db.db
    .selectFrom('record')
    .leftJoin('ipld_block', (join) =>
      join
        .onRef('ipld_block.cid', '=', 'record.cid')
        .onRef('ipld_block.creator', '=', 'record.did'),
    )
    .where('collection', '=', ids.AppBskyGraphFollow)
    .where(sql`random()`, '<', pct)
    .select(['uri', 'ipld_block.content as bytes'])
    .execute()

  console.log(`${SHORT_NAME} dummy check ${testCases.length} test cases`)

  for (const { uri, bytes } of testCases) {
    assert(bytes, `${SHORT_NAME} dummy check failed: ${uri} missing bytes`)
    const record = cborBytesToRecord(bytes)
    assert(
      record['$type'] === ids.AppBskyGraphFollow,
      `${SHORT_NAME} dummy check failed: ${uri} bad record type`,
    )
    try {
      assertValidRecord(record)
    } catch {
      throw new Error(`${SHORT_NAME} dummy check failed: ${uri} invalid record`)
    }
  }
}

async function getAllDids(db: Database) {
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

const sceneDids = new Set([
  'did:plc:6uow4ajxchftgyvvppnqa6uj', // prod
  'did:plc:jo6qdnxnyqdio6cq36xgc6tx',
  'did:plc:ata4ssnzkxdpi2q5pebgbxag',
  'did:plc:vww6spsbf7vpyoestb5lzk44',
  'did:plc:vlsacc3tgj3clrelfdiiqb2o',
  'did:plc:r6ye7ovouy2sv6rkg3yocxrd',
  'did:plc:wmr3iirixxka36wgzfkkmakd',
  'did:plc:nrdqipi4jisuhbkg6h3svnfu',
  'did:plc:snihgjzh7r7b2g3liy6vq6hl',
  'did:plc:yj4flg2llw33a74vf47kuz3f',
  'did:plc:xvgvtntxzol3fa2qeozuxgpr',
  'did:plc:fpmwl2k2mh4r4xhq4wv7oahl',
  'did:plc:go2yr6gc7yzubof477ef5n5q',
  'did:plc:ws3kkwvk5tjyjnlqjfl7ypec',
  'did:plc:rrlz7tykdtbqro6akp7i3rjv',
  'did:plc:ynfpe5pj6tdvai26q54pik2k',
  'did:plc:lzjigfl7mxejfe6s4qva2h4w',
  'did:plc:jdn2cv7yrfh57kl3xxkxk2zb',
  'did:plc:qvvur7brkpbmwfgrxwwljqfx',
  'did:plc:sxezckld4n7edlj74nwdfs6n',
  'did:plc:rty42f6wxdsup346k4jvhiag',
  'did:plc:l5n4qwodg5vfvpqxbcwub76b',
  'did:plc:tlybz2j2q3ip7h5pbykn523y', // staging
  'did:plc:5xa243y3abbkq5ra6qcqr5g5',
  'did:plc:zrlfy63x2phdx4be2fykinbg',
  'did:plc:z7rueyi53jgrkj53hcdfp52u',
  'did:plc:katepdoxo76ngjqandjsaj5u',
  'did:plc:mvlsw6iyi5ewcr3c6ns4fqih',
  'did:plc:yld7vxrxpeymtbgwkes3sam3',
  'did:plc:ahy3hicg6ubuco7oabmqhi2t',
])
