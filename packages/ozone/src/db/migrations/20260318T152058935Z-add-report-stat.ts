import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_stat')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('queueId', 'integer') // NULL = aggregate across all queues
    .addColumn('mode', 'varchar', (col) => col.notNull()) // 'live' or 'historical'
    .addColumn('timeframe', 'varchar', (col) => col.notNull()) // 'day' or 'week'
    .addColumn('inboundCount', 'integer')
    .addColumn('pendingCount', 'integer')
    .addColumn('actionedCount', 'integer')
    .addColumn('escalatedCount', 'integer')
    .addColumn('actionRate', 'integer')
    .addColumn('moderatorDid', 'varchar')
    .addColumn('avgHandlingTimeSec', 'integer')
    .addColumn('computedAt', 'varchar', (col) => col.notNull())
    .execute()

  // queue/aggregate statistics
  await db.schema
    .createIndex('idx_report_stat_queue')
    .on('report_stat')
    .columns(['mode', 'timeframe', 'queueId', 'computedAt'])
    .execute()

  // moderator statistics
  await db.schema
    .createIndex('idx_report_stat_moderator')
    .on('report_stat')
    .columns(['mode', 'timeframe', 'moderatorDid', 'computedAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_stat_queue').ifExists().execute()
  await db.schema.dropIndex('idx_report_stat_moderator').ifExists().execute()
  await db.schema.dropTable('report_stat').ifExists().execute()
}
