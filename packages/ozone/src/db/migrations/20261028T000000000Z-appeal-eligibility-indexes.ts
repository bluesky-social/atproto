import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE Pre-create these indexes CONCURRENTLY in production before migration.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_appeal_active_subject
    ON report (did, "recordPath", id DESC)
    WHERE "reportType" IN ('tools.ozone.report.defs#reasonAppeal', 'com.atproto.moderation.defs#reasonAppeal')
      AND status <> 'closed'
  `.execute(db)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_appeal_closed_subject
    ON report (did, "recordPath", "closedAt" DESC NULLS FIRST, id DESC)
    WHERE "reportType" IN ('tools.ozone.report.defs#reasonAppeal', 'com.atproto.moderation.defs#reasonAppeal')
      AND status = 'closed'
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_report_appeal_active_subject')
    .ifExists()
    .execute()
  await db.schema
    .dropIndex('idx_report_appeal_closed_subject')
    .ifExists()
    .execute()
}
