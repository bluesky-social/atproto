import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Report table - bridges report events to action events
  await db.schema
    .createTable('report')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    // Core link to report event (all metadata comes from moderation_event via JOIN)
    .addColumn('eventId', 'integer', (col) => col.notNull().unique())

    // Queue assignment (computed by background job in future iteration)
    .addColumn('queueId', 'integer') // NULL = not yet assigned, -1 = no matching queue
    .addColumn('queuedAt', 'varchar')

    // Action linkage (sorted DESC, most recent first)
    .addColumn('actionEventIds', 'jsonb') // Array of event IDs: [newest_id, ..., oldest_id]

    // Reporter communication
    .addColumn('actionNote', 'text')

    // Status of the ticket/report
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('open')) // "open", "closed", "escalated"

    // Timestamps
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .execute()

  // Indexes
  // Primary JOIN index - critical for every query
  await db.schema
    .createIndex('idx_report_event')
    .on('report')
    .column('eventId')
    .execute()

  // Queue + status filters with sorting by createdAt (most common query pattern)
  await db.schema
    .createIndex('idx_report_queue_status_created')
    .on('report')
    .columns(['queueId', 'status', 'createdAt', 'id'])
    .execute()

  // Queue + status filters with sorting by updatedAt
  await db.schema
    .createIndex('idx_report_queue_status_updated')
    .on('report')
    .columns(['queueId', 'status', 'updatedAt', 'id'])
    .execute()

  // Status filter with createdAt sorting (when queueId not specified)
  await db.schema
    .createIndex('idx_report_status_created_id')
    .on('report')
    .columns(['status', 'createdAt', 'id'])
    .execute()

  // Status filter with updatedAt sorting
  await db.schema
    .createIndex('idx_report_status_updated_id')
    .on('report')
    .columns(['status', 'updatedAt', 'id'])
    .execute()

  // Default query (no filters) sorted by createdAt
  await db.schema
    .createIndex('idx_report_created_id')
    .on('report')
    .columns(['createdAt', 'id'])
    .execute()

  // Default query sorted by updatedAt
  await db.schema
    .createIndex('idx_report_updated_id')
    .on('report')
    .columns(['updatedAt', 'id'])
    .execute()

  // GIN index for reviewedBy queries (ANY operator on array)
  await db.schema
    .createIndex('idx_report_action_event_ids_gin')
    .on('report')
    .using('gin')
    .column('actionEventIds')
    .execute()

  // Partial index for the queue-router background job.
  // Only indexes unassigned rows (queueId IS NULL), so it shrinks as reports are routed.
  // Supports: WHERE "queueId" IS NULL [AND id > $cursor] ORDER BY id ASC LIMIT n
  // Kysely's CreateIndexBuilder doesn't support partial indexes, so we use raw SQL.
  await sql`CREATE INDEX idx_report_unassigned_id ON report (id) WHERE "queueId" IS NULL`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('report').execute()
}
