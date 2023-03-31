import assert from 'assert'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'

const MIGRATION_NAME = '2023-03-15-update-db-nsids'
const SHORT_NAME = 'update-db-nsids'

export async function updateDbNsidsMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(tx))
}

async function main(tx: Database) {
  console.log(SHORT_NAME, 'beginning')
  tx.assertTransaction()

  const subscriptMethod = tx.db
    .updateTable('subscription')
    .where('method', '=', 'com.atproto.sync.subscribeAllRepos')
    .set({ method: 'com.atproto.sync.subscribeRepos' })
    .execute()

  const actionSubjectRepo = tx.db
    .updateTable('moderation_action')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.repoRef')
    .set({ subjectType: 'com.atproto.admin.defs#repoRef' })
    .execute()

  const actionSubjectRecord = tx.db
    .updateTable('moderation_action')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.recordRef')
    .set({ subjectType: 'com.atproto.repo.strongRef' })
    .execute()

  const reportSubjectRepo = tx.db
    .updateTable('moderation_report')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.repoRef')
    .set({ subjectType: 'com.atproto.admin.defs#repoRef' })
    .execute()

  const reportSubjectRecord = tx.db
    .updateTable('moderation_report')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.recordRef')
    .set({ subjectType: 'com.atproto.repo.strongRef' })
    .execute()

  const reportSpam = tx.db
    .updateTable('moderation_report')
    // @ts-ignore
    .where('reasonType', '=', 'com.atproto.report.reasonType#spam')
    .set({ reasonType: 'com.atproto.moderation.defs#reasonSpam' })
    .execute()

  const reportOther = tx.db
    .updateTable('moderation_report')
    // @ts-ignore
    .where('reasonType', '=', 'com.atproto.report.reasonType#other')
    .set({ reasonType: 'com.atproto.moderation.defs#reasonOther' })
    .execute()

  await Promise.all([
    subscriptMethod,
    actionSubjectRepo,
    actionSubjectRecord,
    reportSubjectRepo,
    reportSubjectRecord,
    reportSpam,
    reportOther,
  ])

  // sanity check

  const check1 = tx.db
    .selectFrom('subscription')
    .where('method', '=', 'com.atproto.sync.subscribeAllRepos')
    .selectAll()
    .execute()

  const check2 = tx.db
    .selectFrom('moderation_action')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.repoRef')
    .selectAll()
    .execute()

  const check3 = tx.db
    .selectFrom('moderation_action')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.recordRef')
    .selectAll()
    .execute()

  const check4 = tx.db
    .selectFrom('moderation_report')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.repoRef')
    .selectAll()
    .execute()

  const check5 = tx.db
    .selectFrom('moderation_report')
    // @ts-ignore
    .where('subjectType', '=', 'com.atproto.repo.recordRef')
    .selectAll()
    .execute()

  const check6 = tx.db
    .selectFrom('moderation_report')
    // @ts-ignore
    .where('reasonType', '=', 'com.atproto.report.reasonType#spam')
    .selectAll()
    .execute()

  const check7 = tx.db
    .selectFrom('moderation_report')
    // @ts-ignore
    .where('reasonType', '=', 'com.atproto.report.reasonType#other')
    .selectAll()
    .execute()

  const res = await Promise.all([
    check1,
    check2,
    check3,
    check4,
    check5,
    check6,
    check7,
  ])
  assert(res[0].length === 0)
  assert(res[1].length === 0)
  assert(res[2].length === 0)
  assert(res[3].length === 0)
  assert(res[4].length === 0)
  assert(res[5].length === 0)
  assert(res[6].length === 0)

  console.log(SHORT_NAME, 'complete')
}
