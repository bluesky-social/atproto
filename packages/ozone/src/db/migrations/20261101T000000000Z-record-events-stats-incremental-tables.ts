import { type Kysely, sql } from 'kysely'
import { OZONE_APPEAL_REASON_TYPE } from '../../api/util.js'
import { chat, com, tools } from '../../lexicons/index.js'

// Expand step towards serving record_events_stats from incrementally
// maintained counts instead of refreshing the materialized view, which
// re-aggregates all of moderation_event and on large deployments runs past
// the refresher's statement timeout. This migration only adds the new
// objects; record_events_stats and account_record_events_stats are untouched
// until a later migration swaps them over once the backfill is done.
//
// - record_events_stats_delta: insert-only queue of per-subject count changes,
//   written by record_events_stats_track() for each in-scope moderation_event
//   write. The trigger takes no row locks and never conflicts.
// - record_events_stats_live: per-subject counts, written only by the daemon's
//   RecordEventsStatsWorker, which folds the deltas and backfills older events
//   in primary-key batches under the job_cursor row inserted below.
//
// The migration stays fast: CREATE TRIGGER takes a SHARE ROW EXCLUSIVE lock on
// moderation_event, blocking its writes until commit, and nothing here scans
// the table. The watermark is read under that lock, at READ COMMITTED so its
// snapshot postdates the lock: every event with id <= watermark is committed
// and belongs to the backfill, and every later one reaches the delta table
// through the triggers, so nothing is counted twice or missed. That relies on
// the id sequence's default CACHE 1, so that ids handed out after commit all
// exceed the watermark.
//
// The SQL is exported as plain strings, free of bind parameters, so a large
// deployment can run exactly what up() runs by hand.

export const RECORD_EVENTS_STATS_BACKFILL_JOB = 'record_events_stats_backfill'

// Quotes a lexicon constant as a SQL string literal.
const lit = (value: string) => `'${value.replace(/'/g, "''")}'`

const STRONG_REF = lit(com.atproto.repo.strongRef.$type)
const CONVO_REF = lit(chat.bsky.convo.defs.convoRef.$type)
const MESSAGE_REF = lit(chat.bsky.convo.defs.messageRef.$type)
const ESCALATE = lit(tools.ozone.moderation.defs.modEventEscalate.$type)
const REPORT = lit(tools.ozone.moderation.defs.modEventReport.$type)
const APPEAL_REASON_TYPES = [
  lit(com.atproto.moderation.defs.reasonAppeal.value),
  lit(OZONE_APPEAL_REASON_TYPE),
].join(', ')
const RECORD_SUBJECT_TYPES = [STRONG_REF, CONVO_REF, MESSAGE_REF].join(', ')

// Same expressions as the materialized view (20260720T000000000Z), written
// against unqualified moderation_event columns so the trigger function can
// evaluate them over OLD/NEW projected under the same names.
const convoId = `COALESCE(NULLIF("subjectConvoId", ''), NULLIF(meta ->> 'convoId', ''))`
const subjectKey = `COALESCE("subjectUri", ${convoId})`
// Parenthesized as a whole so further conditions can be ANDed onto it.
const inScope = `(("subjectType" = ${STRONG_REF} AND "subjectUri" IS NOT NULL) OR ("subjectType" IN (${CONVO_REF}, ${MESSAGE_REF}) AND ${convoId} IS NOT NULL))`
// May be NULL (e.g. a report without reportType), which counts as false.
const isEscalate = `action = ${ESCALATE}`
const isReport = `action = ${REPORT} AND meta ->> 'reportType' NOT IN (${APPEAL_REASON_TYPES})`
const isAppeal = `action = ${REPORT} AND meta ->> 'reportType' IN (${APPEAL_REASON_TYPES})`

export const CREATE_LIVE_TABLE_SQL = `CREATE TABLE record_events_stats_live (
  "subjectDid" varchar NOT NULL,
  "subjectKey" varchar NOT NULL,
  "escalateCount" bigint NOT NULL DEFAULT 0,
  "reportCount" bigint NOT NULL DEFAULT 0,
  "appealCount" bigint NOT NULL DEFAULT 0,
  CONSTRAINT record_events_stats_live_pkey PRIMARY KEY ("subjectDid", "subjectKey")
)`

export const CREATE_DELTA_TABLE_SQL = `CREATE TABLE record_events_stats_delta (
  id bigserial PRIMARY KEY,
  "subjectDid" varchar NOT NULL,
  "subjectKey" varchar NOT NULL,
  "escalateDelta" integer NOT NULL,
  "reportDelta" integer NOT NULL,
  "appealDelta" integer NOT NULL
)`

// SECURITY DEFINER so the triggers can write the table whichever role inserts
// the event (migrations and the app may run as different roles), and
// search_path is pinned to the creating session's so the unqualified names
// resolve to this schema (custom OZONE_DB_POSTGRES_SCHEMA included).
//
// OLD and NEW are projected under the moderation_event column names and
// netted per subject: an INSERT adds NEW, a DELETE subtracts OLD, and an
// UPDATE subtracts OLD and adds NEW, which nets to zero unless the update
// moved the event to another subject, in or out of scope, or between counts.
// A subject on the NEW side that nets to zero still gets an all-zero row, so
// the fold gives every in-scope subject a row as the view does.
export const TRACK_FUNCTION_SQL = `CREATE OR REPLACE FUNCTION record_events_stats_track() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path FROM CURRENT
AS $fn$
BEGIN
  INSERT INTO record_events_stats_delta
    ("subjectDid", "subjectKey", "escalateDelta", "reportDelta", "appealDelta")
  SELECT "subjectDid", "subjectKey", "escalateDelta", "reportDelta", "appealDelta"
  FROM (
    SELECT
      "subjectDid",
      ${subjectKey} AS "subjectKey",
      SUM(sign * COALESCE(${isEscalate}, false)::int) AS "escalateDelta",
      SUM(sign * COALESCE(${isReport}, false)::int) AS "reportDelta",
      SUM(sign * COALESCE(${isAppeal}, false)::int) AS "appealDelta",
      bool_or(sign > 0) AS "hasNew"
    FROM (
      SELECT -1 AS sign, OLD."subjectType", OLD."subjectDid", OLD."subjectUri",
        OLD."subjectConvoId", OLD.action, OLD.meta
      WHERE TG_OP <> 'INSERT'
      UNION ALL
      SELECT 1, NEW."subjectType", NEW."subjectDid", NEW."subjectUri",
        NEW."subjectConvoId", NEW.action, NEW.meta
      WHERE TG_OP <> 'DELETE'
    ) ev
    WHERE ${inScope}
    GROUP BY "subjectDid", ${subjectKey}
  ) d
  WHERE "hasNew" OR "escalateDelta" <> 0 OR "reportDelta" <> 0 OR "appealDelta" <> 0;
  RETURN NULL;
END
$fn$`

const INSERT_TRIGGER = 'moderation_event_record_stats_insert'
const UPDATE_TRIGGER = 'moderation_event_record_stats_update'
const DELETE_TRIGGER = 'moderation_event_record_stats_delete'

// Events of any other subject type (e.g. repoRef) never invoke the function.
export const TRIGGERS_SQL: string[] = [
  `CREATE TRIGGER ${INSERT_TRIGGER}
AFTER INSERT ON moderation_event
FOR EACH ROW
WHEN (NEW."subjectType" IN (${RECORD_SUBJECT_TYPES}))
EXECUTE FUNCTION record_events_stats_track()`,
  `CREATE TRIGGER ${UPDATE_TRIGGER}
AFTER UPDATE OF action, meta, "subjectUri", "subjectConvoId", "subjectDid", "subjectType" ON moderation_event
FOR EACH ROW
WHEN (OLD."subjectType" IN (${RECORD_SUBJECT_TYPES}) OR NEW."subjectType" IN (${RECORD_SUBJECT_TYPES}))
EXECUTE FUNCTION record_events_stats_track()`,
  `CREATE TRIGGER ${DELETE_TRIGGER}
AFTER DELETE ON moderation_event
FOR EACH ROW
WHEN (OLD."subjectType" IN (${RECORD_SUBJECT_TYPES}))
EXECUTE FUNCTION record_events_stats_track()`,
]

// Must run after TRIGGERS_SQL, in the same transaction, see above.
export const INIT_BACKFILL_CURSOR_SQL = `INSERT INTO job_cursor (job, cursor)
SELECT ${lit(RECORD_EVENTS_STATS_BACKFILL_JOB)}, '{"watermark":' || COALESCE(MAX(id), 0) || ',"next":0}'
FROM moderation_event`

// The view's aggregate, minus its GROUP BY, so the backfill can append more
// conditions (an id range) to the WHERE clause.
export const RECORD_STATS_AGGREGATE_SQL = `SELECT
  "subjectDid",
  ${subjectKey} AS "subjectKey",
  COUNT(*) FILTER (WHERE ${isEscalate}) AS "escalateCount",
  COUNT(*) FILTER (WHERE ${isReport}) AS "reportCount",
  COUNT(*) FILTER (WHERE ${isAppeal}) AS "appealCount"
FROM moderation_event
WHERE ${inScope}`

export const RECORD_STATS_GROUP_BY_SQL = `GROUP BY "subjectDid", ${subjectKey}`

// For the swap migration: account_record_events_stats' query over the table,
// and record_events_stats as a plain view keeping the columns readers use.
export const ACCOUNT_STATS_SELECT_SQL = `SELECT
  "subjectDid",
  SUM("reportCount")::bigint AS "totalReports",
  COUNT(*) FILTER (WHERE "reportCount" > 0) AS "reportedCount",
  COUNT(*) FILTER (WHERE "escalateCount" > 0) AS "escalatedCount",
  COUNT(*) FILTER (WHERE "appealCount" > 0) AS "appealedCount"
FROM record_events_stats_live
GROUP BY "subjectDid"`

export const RECORD_STATS_VIEW_SQL = `CREATE VIEW record_events_stats AS
SELECT "subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount"
FROM record_events_stats_live`

export async function up(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  await sql.raw(CREATE_LIVE_TABLE_SQL).execute(db)
  await sql.raw(CREATE_DELTA_TABLE_SQL).execute(db)
  await sql.raw(TRACK_FUNCTION_SQL).execute(db)
  for (const trigger of TRIGGERS_SQL) {
    await sql.raw(trigger).execute(db)
  }
  await sql.raw(INIT_BACKFILL_CURSOR_SQL).execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  for (const trigger of [INSERT_TRIGGER, UPDATE_TRIGGER, DELETE_TRIGGER]) {
    await sql`DROP TRIGGER ${sql.id(trigger)} ON moderation_event`.execute(db)
  }
  await sql`DROP FUNCTION record_events_stats_track()`.execute(db)
  await db.schema.dropTable('record_events_stats_delta').execute()
  await db.schema.dropTable('record_events_stats_live').execute()
  await db
    .deleteFrom('job_cursor')
    .where('job', '=', RECORD_EVENTS_STATS_BACKFILL_JOB)
    .execute()
}
