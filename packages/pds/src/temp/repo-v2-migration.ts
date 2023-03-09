import { chunkArray } from '@atproto/common'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { formatDataKey, Repo } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from '../db'
import SqlRepoStorage from '../sql-repo-storage'

export const runV2Migration = async (db: Database, keypair: Keypair) => {
  await db.transaction(async (dbTxn) => {
    const dids = await getUserDids(dbTxn)
    const total = dids.length
    console.log(`running for ${total} repos`)
    await deleteAllOldData(dbTxn)
    console.log('deleted old data')
    // chunk it into 20 chunks
    const chunked = chunkArray(dids, Math.ceil(total / 20))
    let count = 0
    await Promise.all(
      chunked.map(async (chunk) => {
        for (const row of chunk) {
          await migrateUser(dbTxn, keypair, row.did)
          count++
          console.log(`(${count}/${total})`)
        }
      }),
    )
  })
  // @TODO handle duplicate records!
  // @TODO reset repo_seq table (migration?)
}

export const getUserDids = async (db: Database) => {
  return await db.db.selectFrom('did_handle').select('did').execute()
}

export const deleteAllOldData = async (db: Database): Promise<void> => {
  console.log('deleting')
  await db.db.deleteFrom('repo_op').execute()
  console.log('delete ops')
  await db.db.deleteFrom('repo_commit_block').execute()
  console.log('delete blocks')
  await db.db.deleteFrom('repo_commit_history').execute()
  console.log('delete history')
}

export const migrateUser = async (
  db: Database,
  repoSigningKey: Keypair,
  did: string,
): Promise<void> => {
  // get records
  const recordRows = await db.db
    .selectFrom('record')
    .selectAll()
    .where('did', '=', did)
    .execute()

  await db.db
    .deleteFrom('ipld_block')
    .where('creator', '=', did)
    .where('cid', 'not in', (qb) =>
      qb.selectFrom('record').select('cid').where('did', '=', did),
    )
    .execute()

  // make record map
  const records = recordRows.reduce((acc, cur) => {
    const dataKey = formatDataKey(cur.collection, cur.rkey)
    acc[dataKey] = CID.parse(cur.cid)
    return acc
  }, {} as Record<string, CID>)

  const storage = new SqlRepoStorage(db, did)
  const commit = await Repo.formatInitCommit(
    storage,
    did,
    repoSigningKey,
    records,
  )
  await storage.applyCommit(commit)

  await db.db
    .updateTable('repo_blob')
    .where('did', '=', did)
    .set({ commit: commit.commit.toString() })
    .execute()
}

const run = async () => {
  const db = Database.postgres({
    url: 'postgresql://pg:password@localhost:5432/postgres',
  })
  await db.migrateToLatestOrThrow()
  const keypair = await Secp256k1Keypair.create()
  await runV2Migration(db, keypair)
}

run()
