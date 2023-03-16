import assert from 'assert'
import { chunkArray } from '@atproto/common'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { countAll } from '../db/util'
import { MessageDispatcher } from '../event-stream/message-queue'
import { PreparedDelete, prepareDelete } from '../repo'
import { RepoService } from '../services/repo'

const MIGRATION_NAME = '2023-03-14-remove-declarations'
const SHORT_NAME = 'remove-declarations'

export async function removeDeclarationsMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(tx, ctx))
}

async function main(tx: Database, ctx: AppContext) {
  console.log(SHORT_NAME, 'beginning')
  tx.assertTransaction()
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

  // For each user remove declaration, assertion, confirmation records.

  // Should be 4-5k records
  const recordsToDelete = await tx.db
    .selectFrom('record')
    .where('collection', 'in', [
      'app.bsky.system.declaration',
      'app.bsky.graph.assertion',
      'app.bsky.graph.confirmation',
    ])
    .select(['record.did as did', 'collection', 'rkey'])
    .execute()

  const deletionsByDid = recordsToDelete.reduce((collect, record) => {
    collect[record.did] ??= []
    collect[record.did].push(prepareDelete(record))
    return collect
  }, {} as Record<string, PreparedDelete[]>)
  const didDeletions = Object.entries(deletionsByDid)

  console.log(
    SHORT_NAME,
    `${recordsToDelete.length} deletions across ${didDeletions.length} dids`,
  )

  let didsComplete = 0
  let deletionsComplete = 0
  const chunks = chunkArray(didDeletions, Math.ceil(didDeletions.length / 50))

  await Promise.all(
    chunks.map(async (chunk) => {
      for (const [did, deletions] of chunk) {
        await repoTx.processWrites(did, deletions, now)
        didsComplete += 1
        deletionsComplete += deletions.length
        console.log(
          SHORT_NAME,
          `(${didsComplete}/${didDeletions.length}) dids, (${deletionsComplete}/${recordsToDelete.length}) records`,
        )
      }
    }),
  )

  console.log(SHORT_NAME, 'running dummy check')
  await dummyCheck(tx)

  console.log(
    SHORT_NAME,
    'complete in',
    (Date.now() - Date.parse(now)) / 1000,
    'sec',
  )
}

async function dummyCheck(db: Database) {
  const { count } = await db.db
    .selectFrom('record')
    .where('collection', 'in', [
      'app.bsky.system.declaration',
      'app.bsky.graph.assertion',
      'app.bsky.graph.confirmation',
    ])
    .select(countAll.as('count'))
    .executeTakeFirstOrThrow()
  assert(
    count === 0,
    `${SHORT_NAME} dummy check failed: ${count} records remaining`,
  )
}
