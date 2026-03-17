import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_activity')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('reportId', 'integer', (col) => col.notNull())

    // Discriminator: one of queueActivity | assignmentActivity | escalationActivity
    //                        | closeActivity | internalNoteActivity | publicNoteActivity
    .addColumn('activityType', 'varchar', (col) => col.notNull())

    // The report's status at the moment this activity was recorded.
    // Populated for state-change activity types; null for note-only activities.
    .addColumn('previousStatus', 'varchar')

    // Note fields — separated by audience
    .addColumn('internalNote', 'text') // moderator-only
    .addColumn('publicNote', 'text') // potentially reporter-visible

    // Free-form JSON for loose activity-specific metadata (e.g. { assignmentId: 42 })
    .addColumn('meta', 'jsonb')

    // True when created by an automated process (e.g. queue router)
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
