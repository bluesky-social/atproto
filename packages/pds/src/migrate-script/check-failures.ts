import { countAll } from '../db/util'
import { MigrateDb, getDb } from './db'

const run = async () => {
  const db = getDb()
  const results = await Promise.all([
    totalCount(db),
    failureCount(db),
    failedBlobs(db),
    failedPrefs(db),
    failedTakedowns(db),
  ])
  console.log(`
Total migrations: ${results[0]}
Failed migrations: ${results[1]}
Failed blobs: ${results[2]}
Failed prefs: ${results[3]}
Failed takedowns: ${results[4]}
`)
}

const totalCount = async (db: MigrateDb) => {
  const res = await db
    .selectFrom('status')
    .select(countAll.as('count'))
    .executeTakeFirst()
  return res?.count
}

const failureCount = async (db: MigrateDb) => {
  const res = await db
    .selectFrom('status')
    .select(countAll.as('count'))
    .where('failed', '=', 1)
    .executeTakeFirst()
  return res?.count
}

const failedBlobs = async (db: MigrateDb) => {
  const res = await db
    .selectFrom('failed_blob')
    .select(countAll.as('count'))
    .executeTakeFirst()
  return res?.count
}

const failedPrefs = async (db: MigrateDb) => {
  const res = await db
    .selectFrom('failed_pref')
    .select(countAll.as('count'))
    .executeTakeFirst()
  return res?.count
}

const failedTakedowns = async (db: MigrateDb) => {
  const res = await db
    .selectFrom('failed_takedown')
    .select(countAll.as('count'))
    .executeTakeFirst()
  return res?.count
}

run()
