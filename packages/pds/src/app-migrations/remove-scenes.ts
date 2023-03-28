import assert from 'assert'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'

const MIGRATION_NAME = '2023-03-23-remove-scenes'
const SHORT_NAME = 'remove-scenes'

export async function removeScenesMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(ctx, tx))
}

async function main(ctx: AppContext, tx: Database) {
  console.log(SHORT_NAME, 'beginning')
  tx.assertTransaction()

  const res = await tx.db
    .selectFrom('did_handle')
    .where('actorType', '=', 'app.bsky.system.actorScene')
    .select('did')
    .execute()

  const sceneDids = res.map((row) => row.did)

  if (sceneDids.length < 1) {
    console.log('no scenes to delete')
    return
  }

  await Promise.all(
    sceneDids.map(async (did) => {
      await ctx.services.record(tx).deleteForUser(did)
      await ctx.services.repo(tx).deleteRepo(did)
      await ctx.services.account(tx).deleteUser(did)
    }),
  )

  console.log(`deleted ${sceneDids.length} scenes`)

  // sanity check

  const check1 = tx.db
    .selectFrom('ipld_block')
    .where('creator', 'in', sceneDids)
    .selectAll()
    .execute()

  const check2 = tx.db
    .selectFrom('did_handle')
    .where('did', 'in', sceneDids)
    .selectAll()
    .execute()

  const check3 = tx.db
    .selectFrom('record')
    .where('did', 'in', sceneDids)
    .selectAll()
    .execute()

  const check4 = tx.db
    .selectFrom('assertion')
    .where('creator', 'in', sceneDids)
    .selectAll()
    .execute()

  const checks = await Promise.all([check1, check2, check3, check4])
  assert(checks[0].length === 0)
  assert(checks[1].length === 0)
  assert(checks[2].length === 0)
  assert(checks[3].length === 0)

  console.log(SHORT_NAME, 'complete')
}
