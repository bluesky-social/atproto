import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .addColumn('recommendedLabels', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute()

  // @NOTE: This index should be created CONCURRENTLY in production. Kysely's
  // migration transaction does not support that option.
  // Appeal lookups span open and closed reports - a record gets one appeal
  // ever, so a closed one still blocks - which the existing partial indexes on
  // report deliberately do not cover.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_appeal_subject
    ON report (did, "recordPath", id DESC)
    WHERE "reportType" = 'tools.ozone.report.defs#reasonAppeal'
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_appeal_subject').ifExists().execute()
  await db.schema
    .alterTable('report_queue')
    .dropColumn('recommendedLabels')
    .execute()
}
