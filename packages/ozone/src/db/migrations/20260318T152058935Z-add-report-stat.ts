import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_stat')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('queueId', 'integer', (col) => col.notNull().defaultTo(-1)) // -1 = aggregate across all queues
    .addColumn('mode', 'varchar', (col) => col.notNull()) // 'live' or 'fixed'
    .addColumn('timeframe', 'varchar', (col) => col.notNull()) // 'day' or 'week'
    .addColumn('inboundCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('pendingCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('actionedCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('escalatedCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('actionRate', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('computedAt', 'varchar', (col) => col.notNull())
    .execute()

  // Only one row with live stats per queue.
  // Only one row with live aggregate stats.
  await sql`CREATE UNIQUE INDEX idx_report_stat_live ON report_stat ("queueId", "timeframe") WHERE "mode" = 'live'`.execute(
    db,
  )

  await db.schema
    .createIndex('idx_report_stat_lookup')
    .on('report_stat')
    .columns(['mode', 'timeframe', 'queueId', 'computedAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_stat_lookup').ifExists().execute()
  await db.schema.dropIndex('idx_report_stat_computed_at').ifExists().execute()
  await db.schema.dropIndex('idx_report_stat_live').ifExists().execute()
  await db.schema.dropTable('report_stat').ifExists().execute()
}
