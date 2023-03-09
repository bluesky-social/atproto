import { chunkArray } from '@atproto/common'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { verifyFullHistory, formatDataKey, Repo } from '@atproto/repo'
import assert from 'assert'
import { CID } from 'multiformats/cid'
import Database from '../db'
import SqlRepoStorage from '../sql-repo-storage'

export const runV2Migration = async (db: Database, keypair: Keypair) => {
  await db.transaction(async (dbTxn) => {
    const dids = await getUserDids(dbTxn)
    const total = dids.length
    console.log(`running for ${total} repos`)
    await deleteAllOldData(dbTxn)
    // chunk it into 50 chunks
    const chunked = chunkArray(dids, Math.ceil(total / 50))
    const roots: Record<string, CID> = {}
    let count = 0
    await Promise.all(
      chunked.map(async (chunk) => {
        for (const did of chunk) {
          roots[did] = await migrateUser(dbTxn, keypair, did)
          count++
          console.log(`(${count}/${total})`)
        }
      }),
    )
    assert(count === total)
    await sanityCheck(dbTxn, keypair, roots)
  })
}

export const getUserDids = async (db: Database) => {
  const res = await db.db.selectFrom('did_handle').select('did').execute()
  return res.map((row) => row.did)
}

export const deleteAllOldData = async (db: Database): Promise<void> => {
  console.log('deleting')
  await db.db.deleteFrom('repo_op').execute()
  console.log('deleted ops')
  await db.db.deleteFrom('repo_commit_block').execute()
  console.log('deleted blocks')
  await db.db.deleteFrom('repo_commit_history').execute()
  console.log('deleted history')
}

export const migrateUser = async (
  db: Database,
  repoSigningKey: Keypair,
  did: string,
): Promise<CID> => {
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

  return commit.commit
}

const sanityCheck = async (
  db: Database,
  repoSigningKey: Keypair,
  roots: Record<string, CID>,
) => {
  const repoRoots = await db.db.selectFrom('repo_root').selectAll().execute()
  assert(repoRoots.length === Object.entries(roots).length)
  for (const root of repoRoots) {
    assert(roots[root.did].toString() === root.root)
  }
  console.log('verified roots')

  const repoHistory = await db.db
    .selectFrom('repo_commit_history')
    .selectAll()
    .execute()
  assert(repoHistory.length === Object.entries(roots).length)
  for (const commit of repoHistory) {
    assert(roots[commit.creator].toString() === commit.commit)
    assert(commit.prev === null)
  }
  console.log('verified history')

  // sample 50 random repos & make sure they look good
  let promises: Promise<void>[] = []
  for (let i = 0; i < 100; i++) {
    const random = repoRoots[Math.floor(Math.random() * repoRoots.length)]
    promises.push(
      verifyRepo(db, repoSigningKey, random.did, CID.parse(random.root)),
    )
  }
  await Promise.all(promises)
  console.log('sanity check done')
}

const verifyRepo = async (
  db: Database,
  repoSigningKey: Keypair,
  did: string,
  root: CID,
) => {
  const storage = new SqlRepoStorage(db, did)
  const verified = await verifyFullHistory(
    storage,
    root,
    did,
    repoSigningKey.did(),
  )
  assert(verified.length === 1)
  const commit = verified[0]
  assert(commit.commit.equals(root))
  assert(commit.prev === null)
  assert(commit.diff.updateList().length == 0)
  assert(commit.diff.deleteList().length == 0)

  const adds = commit.diff
    .addList()
    .map((add) => ({ key: add.key, cid: add.cid.toString() }))
    .sort((a, b) => a.key.localeCompare(b.key))
  const recordsRes = await db.db
    .selectFrom('record')
    .innerJoin('ipld_block', (join) =>
      // added the inner join in here to ensure that none of the record cids were deleted from ipld_block
      join
        .onRef('ipld_block.creator', '=', 'record.did')
        .onRef('ipld_block.cid', '=', 'record.cid'),
    )
    .where('did', '=', did)
    .select(['collection', 'rkey', 'ipld_block.cid as cid'])
    .execute()
  const sorted = recordsRes
    .map((row) => ({
      key: formatDataKey(row.collection, row.rkey),
      cid: row.cid,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  assert.deepStrictEqual(adds, sorted)
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
