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
    .addColumn('closedAt', 'varchar')
    .execute()

  // ─── Indexes ───
  // Primary JOIN index - critical for every query that fetches display data from moderation_event
  await db.schema
    .createIndex('idx_report_event')
    .on('report')
    .column('eventId')
    .execute()

  // ─── Hot path: active reports (status != 'closed') ───
  // Partial filter keeps these tight even as closed reports accumulate (~90% of table long-term).
  // No isMuted in key (low cardinality, rarely filtered) and no INCLUDE columns
  // (display data comes from moderation_event JOIN anyway).

  // queryReports: queueId + status, paginated by createdAt
  await sql`CREATE INDEX idx_report_active_queue_created ON report
    ("queueId", status, "createdAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // queryReports: queueId + status, paginated by updatedAt
  await sql`CREATE INDEX idx_report_active_queue_updated ON report
    ("queueId", status, "updatedAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // queryReports: status only, paginated by createdAt
  await sql`CREATE INDEX idx_report_active_status_created ON report
    (status, "createdAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // queryReports: status only, paginated by updatedAt
  await sql`CREATE INDEX idx_report_active_status_updated ON report
    (status, "updatedAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // Active reports for a specific account (with optional queueId post-filter)
  await sql`CREATE INDEX idx_report_active_did_created ON report
    (did, status, "createdAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // A moderator's active workload (with optional queueId post-filter)
  await sql`CREATE INDEX idx_report_active_assigned_created ON report
    ("assignedTo", status, "createdAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // findReportsForSubject hot path — always filters NOT IN ('closed').
  // did + recordPath identify the subject (account or specific record).
  await sql`CREATE INDEX idx_report_subject_active ON report
    (did, "recordPath", "createdAt" DESC, id DESC)
    WHERE status != 'closed'`.execute(db)

  // ─── Closed history (status = 'closed') ───
  // Closed reports are terminal; only sort by createdAt.

  // Closed pagination per queue
  await sql`CREATE INDEX idx_report_closed_queue_created ON report
    ("queueId", "createdAt" DESC, id DESC)
    WHERE status = 'closed'`.execute(db)

  // Closed history for an account
  await sql`CREATE INDEX idx_report_closed_did_created ON report
    (did, "createdAt" DESC, id DESC)
    WHERE status = 'closed'`.execute(db)

  // Moderator's closed-report history
  await sql`CREATE INDEX idx_report_closed_assigned_created ON report
    ("assignedTo", "createdAt" DESC, id DESC)
    WHERE status = 'closed'`.execute(db)

  // ─── Other access patterns ───

  // Collection prefix queries: left-anchored LIKE 'app.bsky.feed.post/%' or 'app.bsky.%'
  // text_pattern_ops enables btree-scannable prefix matching (supported since Postgres 8.x)
  await sql`CREATE INDEX idx_report_record_path_pattern ON report
    ("recordPath" text_pattern_ops)`.execute(db)

  // Queue-router covering partial: index-only scan over unrouted, non-closed rows.
  // Selects exactly the columns the router reads, eliminating heap fetches per batch.
  await sql`CREATE INDEX idx_report_unassigned_id ON report (id)
    INCLUDE (status, "reportType", "recordPath", "subjectMessageId")
    WHERE "queueId" IS NULL AND status != 'closed'`.execute(db)

  // Index for report statistics
  await db.schema
    .createIndex('idx_report_queue_created_id')
    .on('report')
    .columns(['queueId', 'createdAt', 'id'])
    .execute()

  // aggregate pending count query
  await sql`CREATE INDEX idx_report_pending ON report (id) WHERE status != 'closed'`.execute(
    db,
  )
  // per-queue pending count query
  await sql`CREATE INDEX idx_report_queue_pending ON report ("queueId") WHERE status != 'closed'`.execute(
    db,
  )

  // Queue-router event-source partial: scans new modEventReport rows by id
  // for the daemon that inserts report rows from moderation_event.
  await sql`CREATE INDEX moderation_event_report_id_idx
    ON moderation_event (id)
    WHERE action = 'tools.ozone.moderation.defs#modEventReport'`.execute(db)

  // Stats windowed queries: aggregate/typeWindow filter by createdAt range and
  // include both open and closed reports, so they cannot use the partial indexes
  // above. (createdAt, reportType) ordering serves the date-range scan and
  // satisfies GROUP BY reportType from the index without a heap fetch.
  await sql`CREATE INDEX idx_report_created_type
    ON report ("createdAt", "reportType")`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_report_id_idx').execute()
  await db.schema.dropTable('report').execute()
}
