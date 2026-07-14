import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Supports time-ordered scans across all reports for downstream pollers
  // (e.g. Nimbus' report-activity watcher). The existing indexes are all
  // leading-`reportId`, which would force a sequential scan for global
  // ordered queries.
  await db.schema
    .createIndex('idx_report_activity_created')
    .on('report_activity')
    .columns(['createdAt', 'id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_activity_created').execute()
}
