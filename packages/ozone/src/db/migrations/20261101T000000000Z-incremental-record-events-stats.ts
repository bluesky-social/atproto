import { type Kysely, sql } from 'kysely'
import { OZONE_APPEAL_REASON_TYPE } from '../../api/util.js'
import { chat, com, tools } from '../../lexicons/index.js'

// Maintain record_events_stats incrementally instead of refreshing it.
//
// Refreshing the materialized view re-aggregates all of moderation_event,
// which on large deployments runs past the refresher's statement timeout on
// every cycle and leaves the view stale. moderation_event is effectively
// append-only, so the counts are now kept exact by row triggers:
//
// - record_events_stats_live: plain table holding the per-subject counts,
//   written only by record_events_stats_track(). It is never renamed, so the
//   triggers stay valid whatever happens to the objects around it.
// - record_events_stats: plain view over the table, keeping the relation name
//   and columns readers already use.
// - account_record_events_stats: unchanged query, still a materialized view
//   refreshed by the daemon, but built over the table so it doesn't depend on
//   the view.
//
// Each in-scope event adds 0/1 to its subject's counts. Events that count
// nothing (most of them) still ensure the subject has a row, as the view had
// a row for every in-scope subject, but via ON CONFLICT DO NOTHING so they
// take no row lock. A DELETE subtracts the event's counts but leaves the row
// in place even at zero: knowing whether other events remain would cost a
// scan, and nothing deletes in-scope events today.
//
// Lock behavior: CREATE TRIGGER takes a SHARE ROW EXCLUSIVE lock on
// moderation_event, which is held until commit and blocks writes (not reads)
// for the rest of this migration, including the full backfill. That is also
// what makes the backfill exact: at READ COMMITTED its snapshot is taken
// after the lock, so every earlier event is in it and every later one goes
// through the triggers. On large deployments the backfill takes minutes, so
// they should instead run the equivalent steps outside a single transaction
// (watermark plus chunked backfill), using the SQL exported below.
//
// The SQL is exported as plain strings, free of bind parameters, so that
// procedure can run exactly what up() runs.

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

// SECURITY DEFINER so the triggers can write the table whichever role inserts
// the event (migrations and the app may run as different roles), and
// search_path is pinned to the creating session's so the unqualified names
// resolve to this schema (custom OZONE_DB_POSTGRES_SCHEMA included).
//
// OLD and NEW are projected under the moderation_event column names and
// netted per subject: an INSERT adds NEW, a DELETE subtracts OLD, and an
// UPDATE subtracts OLD and adds NEW, which is a no-op unless the update moved
// the event to another subject, in or out of scope, or between counts.
export const TRACK_FUNCTION_SQL = `CREATE OR REPLACE FUNCTION record_events_stats_track() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path FROM CURRENT
AS $fn$
DECLARE
  d record;
BEGIN
  FOR d IN
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
  LOOP
    IF d."escalateDelta" <> 0 OR d."reportDelta" <> 0 OR d."appealDelta" <> 0 THEN
      INSERT INTO record_events_stats_live AS s
        ("subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount")
      VALUES
        (d."subjectDid", d."subjectKey", d."escalateDelta", d."reportDelta", d."appealDelta")
      ON CONFLICT ("subjectDid", "subjectKey") DO UPDATE SET
        "escalateCount" = s."escalateCount" + excluded."escalateCount",
        "reportCount" = s."reportCount" + excluded."reportCount",
        "appealCount" = s."appealCount" + excluded."appealCount";
    ELSIF d."hasNew" THEN
      -- Nothing counted: only make sure the subject has a row, without
      -- locking an existing one.
      INSERT INTO record_events_stats_live
        ("subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount")
      VALUES (d."subjectDid", d."subjectKey", 0, 0, 0)
      ON CONFLICT DO NOTHING;
    END IF;
    -- A subject left with only OLD's uncounted event keeps its row as is.
  END LOOP;
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

// The view's aggregate, minus its GROUP BY, so a chunked backfill can append
// more conditions (e.g. an id range) to the WHERE clause.
export const RECORD_STATS_AGGREGATE_SQL = `SELECT
  "subjectDid",
  ${subjectKey} AS "subjectKey",
  COUNT(*) FILTER (WHERE ${isEscalate}) AS "escalateCount",
  COUNT(*) FILTER (WHERE ${isReport}) AS "reportCount",
  COUNT(*) FILTER (WHERE ${isAppeal}) AS "appealCount"
FROM moderation_event
WHERE ${inScope}`

export const RECORD_STATS_GROUP_BY_SQL = `GROUP BY "subjectDid", ${subjectKey}`

const accountStatsSelectSql = (source: string) => `SELECT
  "subjectDid",
  SUM("reportCount")::bigint AS "totalReports",
  COUNT(*) FILTER (WHERE "reportCount" > 0) AS "reportedCount",
  COUNT(*) FILTER (WHERE "escalateCount" > 0) AS "escalatedCount",
  COUNT(*) FILTER (WHERE "appealCount" > 0) AS "appealedCount"
FROM ${source}
GROUP BY "subjectDid"`

export const ACCOUNT_STATS_SELECT_SQL = accountStatsSelectSql(
  'record_events_stats_live',
)

export const RECORD_STATS_VIEW_SQL = `CREATE VIEW record_events_stats AS
SELECT "subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount"
FROM record_events_stats_live`

const COLUMNS = `("subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount")`

export async function up(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  // A leftover from manual work would collide with the build below.
  await db.schema
    .dropView('account_record_events_stats_new')
    .materialized()
    .ifExists()
    .execute()

  await sql.raw(CREATE_LIVE_TABLE_SQL).execute(db)
  await sql.raw(TRACK_FUNCTION_SQL).execute(db)
  // Blocks writes to moderation_event until commit, see above.
  for (const trigger of TRIGGERS_SQL) {
    await sql.raw(trigger).execute(db)
  }

  // The table is empty and no other session can insert events until commit.
  await sql
    .raw(
      `INSERT INTO record_events_stats_live ${COLUMNS}\n${RECORD_STATS_AGGREGATE_SQL}\n${RECORD_STATS_GROUP_BY_SQL}`,
    )
    .execute(db)

  await db.schema
    .createView('account_record_events_stats_new')
    .materialized()
    .as(sql.raw(ACCOUNT_STATS_SELECT_SQL))
    .execute()

  await db.schema
    .createIndex('account_record_events_stats_did_idx_new')
    .unique()
    .on('account_record_events_stats_new')
    .column('subjectDid')
    .execute()

  await db.schema
    .createIndex('account_record_events_stats_reported_count_idx_new')
    .on('account_record_events_stats_new')
    .expression(sql`"reportedCount" ASC NULLS FIRST`)
    .column('subjectDid')
    .execute()

  // Swap phase
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').materialized().execute()

  await sql.raw(RECORD_STATS_VIEW_SQL).execute(db)

  await sql`ALTER MATERIALIZED VIEW "account_record_events_stats_new" RENAME TO "account_record_events_stats"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_did_idx_new" RENAME TO "account_record_events_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_reported_count_idx_new" RENAME TO "account_record_events_stats_reported_count_idx"`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  // Restore the materialized views per 20260720T000000000Z. Build first: the
  // triggers stay in place until the swap, since dropping them takes an
  // ACCESS EXCLUSIVE lock on moderation_event that would block reads too.
  await db.schema
    .createView('record_events_stats_new')
    .materialized()
    .as(sql.raw(`${RECORD_STATS_AGGREGATE_SQL}\n${RECORD_STATS_GROUP_BY_SQL}`))
    .execute()

  // Final name directly: the live table only owns record_events_stats_live_pkey
  await db.schema
    .createIndex('record_events_stats_did_key_idx')
    .unique()
    .on('record_events_stats_new')
    .columns(['subjectDid', 'subjectKey'])
    .execute()

  await db.schema
    .createView('account_record_events_stats_new')
    .materialized()
    .as(sql.raw(accountStatsSelectSql('record_events_stats_new')))
    .execute()

  await db.schema
    .createIndex('account_record_events_stats_did_idx_new')
    .unique()
    .on('account_record_events_stats_new')
    .column('subjectDid')
    .execute()

  await db.schema
    .createIndex('account_record_events_stats_reported_count_idx_new')
    .on('account_record_events_stats_new')
    .expression(sql`"reportedCount" ASC NULLS FIRST`)
    .column('subjectDid')
    .execute()

  // Swap phase
  for (const trigger of [INSERT_TRIGGER, UPDATE_TRIGGER, DELETE_TRIGGER]) {
    await sql`DROP TRIGGER ${sql.id(trigger)} ON moderation_event`.execute(db)
  }
  await sql`DROP FUNCTION record_events_stats_track()`.execute(db)

  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').execute()
  await db.schema.dropTable('record_events_stats_live').execute()

  await sql`ALTER MATERIALIZED VIEW "record_events_stats_new" RENAME TO "record_events_stats"`.execute(
    db,
  )
  await sql`ALTER MATERIALIZED VIEW "account_record_events_stats_new" RENAME TO "account_record_events_stats"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_did_idx_new" RENAME TO "account_record_events_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_reported_count_idx_new" RENAME TO "account_record_events_stats_reported_count_idx"`.execute(
    db,
  )
}
