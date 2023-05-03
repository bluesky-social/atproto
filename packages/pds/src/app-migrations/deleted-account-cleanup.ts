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
  const softDeletedAccounts = await tx.db
    .selectFrom('moderation_action')
    .innerJoin('repo_root', (join) =>
      join
        .onRef('repo_root.did', '=', 'moderation_action.subjectDid')
        .onRef('repo_root.takedownId', '=', 'moderation_action.id'),
    )
    .where('reason', '=', 'ACCOUNT DELETION')
    .where('action', '=', 'com.atproto.admin.defs#takedown')
    .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
    .whereRef('subjectDid', '=', 'createdBy')
    .where('reversedAt', 'is', null)
    .select(['subjectDid as did', 'takedownId'])
    .execute()

  if (softDeletedAccounts.length >= 50) {
    throw error(
      `bad number of soft-deleted accounts prepared for cleanup: ${softDeletedAccounts.length}`,
    )
  }

  tx.onCommit(async () => {
    for (const { did, takedownId } of softDeletedAccounts) {
      if (!takedownId) {
        // pure dummy-check
        log(`bailing, saw an account that was not taken down: ${did}`)
        break
      }
      try {
        await ctx.services.record(ctx.db).deleteForActor(did)
        await ctx.services.repo(ctx.db).deleteRepo(did)
        await ctx.services.account(ctx.db).deleteAccount(did)
        log(did, 'cleaned-up')
        await wait(2000) // cool-off to avoid high rate of expensive takedowns
      } catch (err) {
        log(did, 'clean-up failed', err)
      }
    }
  })
}

function log(...args) {
  console.log(SHORT_NAME, ...args)
}

function error(message: string) {
  return new Error(`${SHORT_NAME}: ${message}`)
}
