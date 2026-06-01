import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_stat')

    // metadata
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('computedAt', 'varchar', (col) => col.notNull())

    // group
    .addColumn('date', 'varchar', (col) => col.notNull()) // ISO date e.g. '2026-04-15'
    .addColumn('queueId', 'integer') // NULL = aggregate across all queues
    .addColumn('reportTypes', 'jsonb') // NULL = aggregate across all report types
    .addColumn('moderatorDid', 'varchar') // NULL = aggregate across all moderators

    // stats
    .addColumn('inboundCount', 'integer')
    .addColumn('pendingCount', 'integer')
    .addColumn('actionedCount', 'integer')
    .addColumn('escalatedCount', 'integer')
    .addColumn('actionRate', 'integer')
    .addColumn('avgHandlingTimeSec', 'integer')
    .execute()

  // Lookup by date + group dimensions (covers getLiveStats and getHistoricalStats queries)
  await sql`CREATE INDEX idx_report_stat_lookup ON report_stat (
    date, "queueId", "moderatorDid", "reportTypes", "computedAt"
  )`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_stat_lookup').ifExists().execute()
  await db.schema.dropTable('report_stat').ifExists().execute()
}
