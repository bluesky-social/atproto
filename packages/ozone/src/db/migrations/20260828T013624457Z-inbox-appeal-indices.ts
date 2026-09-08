import { type Kysely, sql } from 'kysely'

// The action types the moderation inbox reads. Kept as literals rather than
// imported so the migration stays pinned to the shape of the index it built,
// even if the application's list later changes.
const INBOX_ACTIONS = sql`(
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventEmail',
  'tools.ozone.moderation.defs#modEventMuteReporter',
  'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
  'tools.ozone.moderation.defs#modEventReverseTakedown'
)`

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE: These queries should be run with the "CONCURRENTLY" option in
  // production to avoid locking the table. This is not supported by Kysely.

  // Reports are linked to the events that resolved them through a jsonb array,
  // and appeal creation looks a report up by that link. Without a GIN index
  // that containment test is a sequential scan of every report.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_action_event_ids
    ON report USING gin ("actionEventIds" jsonb_path_ops)
  `.execute(db)

  // Appeal lookups span open and closed reports - a record gets one appeal
  // ever, so a closed one still blocks - which the existing partial indexes on
  // report deliberately do not cover.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_report_appeal_subject
    ON report (did, "recordPath", id DESC)
    WHERE "reportType" = 'tools.ozone.report.defs#reasonAppeal'
  `.execute(db)

  // The inbox reads a wider set of action types than the existing partial
  // indexes on moderation_event, which cover takedown and label only. Without
  // a matching predicate these reads fall back to scanning everything ever
  // recorded against the subject.
  // Chat messages and conversations also carry a null `subjectUri`, so the
  // account index excludes them by name. Otherwise every chat event recorded
  // against a DID sits in the index its account reads.
  await sql`
    CREATE INDEX IF NOT EXISTS moderation_event_inbox_account_idx
    ON moderation_event ("subjectDid", id DESC)
    INCLUDE ("createdAt")
    WHERE "subjectUri" IS NULL
      AND "subjectMessageId" IS NULL
      AND "subjectConvoId" IS NULL
      AND action IN ${INBOX_ACTIONS}
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS moderation_event_inbox_record_idx
    ON moderation_event ("subjectUri", id DESC)
    INCLUDE ("createdAt")
    WHERE "subjectUri" IS NOT NULL AND action IN ${INBOX_ACTIONS}
  `.execute(db)

  // Chat subjects get their own indexes: the existing
  // `moderation_event_message_id_idx` is restricted to report events and does
  // not cover the actions the inbox reads.
  await sql`
    CREATE INDEX IF NOT EXISTS moderation_event_inbox_message_idx
    ON moderation_event ("subjectMessageId", id DESC)
    INCLUDE ("createdAt")
    WHERE "subjectMessageId" IS NOT NULL AND action IN ${INBOX_ACTIONS}
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS moderation_event_inbox_convo_idx
    ON moderation_event ("subjectConvoId", id DESC)
    INCLUDE ("createdAt")
    WHERE "subjectConvoId" IS NOT NULL
      AND "subjectMessageId" IS NULL
      AND action IN ${INBOX_ACTIONS}
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('moderation_event_inbox_convo_idx')
    .ifExists()
    .execute()
  await db.schema
    .dropIndex('moderation_event_inbox_message_idx')
    .ifExists()
    .execute()
  await db.schema
    .dropIndex('moderation_event_inbox_record_idx')
    .ifExists()
    .execute()
  await db.schema
    .dropIndex('moderation_event_inbox_account_idx')
    .ifExists()
    .execute()
  await db.schema.dropIndex('idx_report_appeal_subject').ifExists().execute()
  await db.schema.dropIndex('idx_report_action_event_ids').ifExists().execute()
}
