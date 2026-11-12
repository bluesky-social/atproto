import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('inbox_seen')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('section', 'varchar', (col) => col.notNull())
    .addColumn('seenAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('inbox_seen_pk', ['did', 'section'])
    .execute()

  // @NOTE Pre-create these indexes CONCURRENTLY in production. IF NOT EXISTS
  // reuses them because the migration runner wraps this migration in a transaction.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_reporter_updated
    ON report ("reporterDid", "updatedAt" DESC, id DESC)
    WHERE "reportType" <> 'tools.ozone.report.defs#reasonAppeal'
  `.execute(db)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_reporter_created
    ON report ("reporterDid", "createdAt" DESC, id DESC)
    WHERE "reportType" <> 'tools.ozone.report.defs#reasonAppeal'
  `.execute(db)
  // @NOTE Cover the public-action aggregation without fetching private events.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_moderation_event_inbox_public_created
    ON moderation_event ("subjectDid", "createdAt" DESC, id DESC)
    INCLUDE ("subjectUri", action)
    WHERE "subjectType" IN (
      'com.atproto.admin.defs#repoRef', 'com.atproto.repo.strongRef'
    ) AND action IN (
      'tools.ozone.moderation.defs#modEventTakedown',
      'tools.ozone.moderation.defs#modEventLabel',
      'tools.ozone.moderation.defs#modEventEmail',
      'tools.ozone.moderation.defs#modEventMuteReporter',
      'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
      'tools.ozone.moderation.defs#modEventReverseTakedown'
    )
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_moderation_event_inbox_public_created')
    .ifExists()
    .execute()
  await db.schema.dropIndex('idx_report_reporter_created').ifExists().execute()
  await db.schema.dropIndex('idx_report_reporter_updated').ifExists().execute()
  await db.schema.dropTable('inbox_seen').execute()
}
