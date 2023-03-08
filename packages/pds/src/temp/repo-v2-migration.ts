import { Keypair } from '@atproto/crypto'
import { formatDataKey, Repo } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import AppContext from '../context'
import Database from '../db'
import SqlRepoStorage from '../sql-repo-storage'

export const runV2Migration = async (ctx: AppContext) => {
  ctx.db.transaction(async (dbTxn) => {
    const dids = await getUserDids(dbTxn)
    await deleteAllOldData(dbTxn)
    await Promise.all(
      dids.map(async (row) => {
        if (row.actorType === 'app.bsky.system.actorScene') {
          await deleteScene(ctx, dbTxn, row.did)
        } else {
          await migrateUser(dbTxn, ctx.repoSigningKey, row.did)
        }
      }),
    )
  })
  // @TODO handle duplicate records!
  // @TODO reset repo_seq table (migration?)
}

export const getUserDids = async (db: Database) => {
  return await db.db
    .selectFrom('did_handle')
    .select(['did', 'actorType'])
    .execute()
}

export const deleteScene = async (
  ctx: AppContext,
  db: Database,
  did: string,
) => {
  await ctx.services.record(db).deleteForUser(did)
  await ctx.services.repo(db).deleteRepo(did)
  await ctx.services.account(db).deleteUser(did)
}

export const deleteAllOldData = async (db: Database): Promise<void> => {
  // delete all ipld_blocks that do not reference records
  await db.db
    .deleteFrom('ipld_block')
    .where('cid', 'not in', (qb) => qb.selectFrom('record').select('cid'))
    .execute()

  // delete all repo_ops, commit blocks, commit history
  await db.db.deleteFrom('repo_op').execute()
  await db.db.deleteFrom('repo_commit_block').execute()
  await db.db.deleteFrom('repo_commit_history').execute()
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
