import { wait } from '@atproto/common'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'

const MIGRATION_NAME = '2023-05-03-deleted-account-cleanup'
const SHORT_NAME = 'deleted-account-cleanup'

export async function deletedAccountCleanupMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(tx, ctx))
}

async function main(tx: Database, ctx: AppContext) {
  log('beginning')

  const softDeletedAccounts = await tx.db
    .selectFrom('moderation_action')
    // did_handle is last table hit by account deletion
    .innerJoin('did_handle', 'did_handle.did', 'moderation_action.subjectDid')
    .where('reason', '=', 'ACCOUNT DELETION')
    .where('action', '=', 'com.atproto.admin.defs#takedown')
    .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
    .whereRef('subjectDid', '=', 'createdBy')
    .where('reversedAt', 'is', null)
    .select('subjectDid as did')
    .execute()

  if (softDeletedAccounts.length >= 50) {
    throw error(
      `bad number of soft-deleted accounts prepared for cleanup: ${softDeletedAccounts.length}`,
    )
  }

  tx.onCommit(async () => {
    for (const { did } of softDeletedAccounts) {
      try {
        log(did, 'starting clean-up')
        await ctx.services.record(ctx.db).deleteForActor(did)
        await ctx.services.repo(ctx.db).deleteRepo(did)
        await ctx.services.account(ctx.db).deleteAccount(did)
        log(did, 'cleaned-up')
        await wait(2000) // cool-off to avoid high rate of expensive takedowns
      } catch (err) {
        log(did, 'clean-up failed', err)
      }
    }
    log('complete')
  })
}

function log(...args) {
  console.log(SHORT_NAME, ...args)
}

function error(message: string) {
  return new Error(`${SHORT_NAME}: ${message}`)
}
