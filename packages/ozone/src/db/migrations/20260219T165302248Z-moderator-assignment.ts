import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('moderator_assignment')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    // assignee
    .addColumn('did', 'text', (col) => col.notNull())
    // assigned over
    .addColumn('reportId', 'integer')
    .addColumn('queueId', 'integer')
    // validity
    .addColumn('startAt', 'varchar', (col) => col.notNull())
    .addColumn('endAt', 'varchar', (col) => col.notNull())
    .execute()

  // Partial index for getting active queue assignments
  await sql`CREATE INDEX idx_assignment_queue_active ON moderator_assignment ("endAt") WHERE "reportId" IS NULL`.execute(
    db,
  )

  // Partial index for getting active report assignments for queue
  await sql`CREATE INDEX idx_assignment_report_by_queue ON moderator_assignment ("queueId", "endAt") WHERE "reportId" IS NOT NULL`.execute(
    db,
  )

  // Index for checking active report assignment
  await db.schema
    .createIndex('idx_assignment_report_active')
    .on('moderator_assignment')
    .columns(['reportId', 'endAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('moderator_assignment').ifExists().execute()
}
