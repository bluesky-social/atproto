import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_stat')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('queueId', 'integer') // NULL = aggregate across all queues
    .addColumn('periodType', 'varchar', (col) => col.notNull()) // 'live' or 'daily'
    .addColumn('inboundCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('pendingCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('actionedCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('escalatedCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('actionRate', 'integer') // NULL when inboundCount = 0
    .addColumn('computedAt', 'varchar', (col) => col.notNull())
    .execute()

  // Unique constraint for upserts: one row per (queue, periodType).
  // COALESCE handles NULL queueId (aggregate row) by mapping it to -1.
  await sql`CREATE UNIQUE INDEX idx_report_stat_queue_period ON report_stat (COALESCE("queueId", -1), "periodType")`.execute(
    db,
  )

  await db.schema
    .createIndex('idx_report_stat_computed_at')
    .on('report_stat')
    .column('computedAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('report_stat').execute()
}
