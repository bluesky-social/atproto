import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Report table - bridges report events to action events
  await db.schema
    .createTable('report')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    // Core link to report event (display data still comes from moderation_event via JOIN)
    .addColumn('eventId', 'integer', (col) => col.notNull().unique())

    // Queue assignment (computed by background job in future iteration)
    .addColumn('queueId', 'integer') // NULL = not yet assigned, -1 = no matching queue
    .addColumn('queuedAt', 'varchar')

    // Action linkage (sorted DESC, most recent first)
    .addColumn('actionEventIds', 'jsonb') // Array of event IDs: [newest_id, ..., oldest_id]

    // Reporter communication
    .addColumn('actionNote', 'text')

    // Whether the report is muted (reporter was muted or subject was muted at creation time)
    .addColumn('isMuted', 'boolean', (col) => col.notNull().defaultTo(false))

    // Status of the ticket/report
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('open')) // "open", "closed", "escalated"

    // Denormalized from moderation_event for filtering without JOIN
    .addColumn('reportType', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('recordPath', 'varchar', (col) => col.notNull().defaultTo('')) // '' = account/message, 'collection/rkey' = record
    .addColumn('subjectMessageId', 'varchar') // NULL for non-message subjects

    // Timestamps
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('assignedTo', 'varchar') // DID of permanently assigned moderator
    .addColumn('assignedAt', 'varchar') // When the permanent assignment was created
    .execute()

  // ─── Indexes ───
  // Primary JOIN index - critical for every query that fetches display data from moderation_event
  await db.schema
    .createIndex('idx_report_event')
    .on('report')
    .column('eventId')
    .execute()

  // Covering indexes for queryReports pagination.
  // Btree columns: equality filters (prefix) + sort + tiebreaker.
  // INCLUDE columns: stored in leaf pages for index-level filtering without heap access.
  // Postgres scans the btree in sort order and checks INCLUDE columns before visiting the heap,
  // so selective filters like reportType or did skip heap fetches for non-matching rows.

  // Queue + status + muted, sorted by createdAt (most common query pattern)
  await sql`CREATE INDEX idx_report_queue_status_created ON report
    ("queueId", status, "isMuted", "createdAt", id)
    INCLUDE (did, "recordPath", "reportType", "subjectMessageId", "assignedTo")`.execute(
    db,
  )

  // Queue + status + muted, sorted by updatedAt
  await sql`CREATE INDEX idx_report_queue_status_updated ON report
    ("queueId", status, "isMuted", "updatedAt", id)
    INCLUDE (did, "recordPath", "reportType", "subjectMessageId", "assignedTo")`.execute(
    db,
  )

  // Status + muted, sorted by createdAt (when queueId not specified)
  await sql`CREATE INDEX idx_report_status_created ON report
    (status, "isMuted", "createdAt", id)
    INCLUDE (did, "recordPath", "reportType", "subjectMessageId", "assignedTo")`.execute(
    db,
  )

  // Status + muted, sorted by updatedAt (when queueId not specified)
  await sql`CREATE INDEX idx_report_status_updated ON report
    (status, "isMuted", "updatedAt", id)
    INCLUDE (did, "recordPath", "reportType", "subjectMessageId", "assignedTo")`.execute(
    db,
  )

  // Subject-specific lookups (findReportsForSubject, queryReports with subject filter).
  // did + recordPath identify the subject; status enables open/escalated filtering.
  await sql`CREATE INDEX idx_report_subject ON report
    (did, "recordPath", status, "createdAt", id)`.execute(db)

  // Collection prefix queries: left-anchored LIKE 'app.bsky.feed.post/%' or 'app.bsky.%'
  // text_pattern_ops enables btree-scannable prefix matching (supported since Postgres 8.x)
  await sql`CREATE INDEX idx_report_record_path_pattern ON report
    ("recordPath" text_pattern_ops)`.execute(db)

  // GIN index for reviewedBy queries (ANY operator on array)
  await db.schema
    .createIndex('idx_report_action_event_ids_gin')
    .on('report')
    .using('gin')
    .column('actionEventIds')
    .execute()

  // Partial index for the queue-router background job.
  // Only indexes unassigned rows (queueId IS NULL), so it shrinks as reports are routed.
  await sql`CREATE INDEX idx_report_unassigned_id ON report (id) WHERE "queueId" IS NULL`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('report').execute()
}
