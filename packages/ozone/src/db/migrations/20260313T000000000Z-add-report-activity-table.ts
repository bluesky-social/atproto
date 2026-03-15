import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_activity')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('reportId', 'integer', (col) => col.notNull())

    // Type of activity: 'status_change', 'note'
    .addColumn('action', 'varchar', (col) => col.notNull())

    // State transition fields — only populated for status_change actions
    .addColumn('fromState', 'varchar')
    .addColumn('toState', 'varchar')

    // Optional human-readable note, usable on any action type
    .addColumn('note', 'text')

    // Extensible JSON payload for future action-specific metadata
    .addColumn('meta', 'jsonb')

    // True when this activity was created by an automated process (e.g. queue router)
    // rather than a direct human action
    .addColumn('isAutomated', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )

    .addColumn('createdBy', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  // Primary filter: all activities for a given report, sorted most-recent-first
  await db.schema
    .createIndex('idx_report_activity_report_created')
    .on('report_activity')
    .columns(['reportId', 'createdAt', 'id'])
    .execute()

  // Partial index to efficiently find automated activities per report
  await sql`CREATE INDEX idx_report_activity_automated ON report_activity ("reportId", "createdAt", id) WHERE "isAutomated" = true`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('report_activity').execute()
}
