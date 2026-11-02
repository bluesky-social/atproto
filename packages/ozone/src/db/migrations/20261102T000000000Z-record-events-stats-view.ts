import { type Kysely, sql } from 'kysely'
import {
  ACCOUNT_STATS_SELECT_SQL,
  RECORD_EVENTS_STATS_BACKFILL_JOB,
  RECORD_STATS_AGGREGATE_SQL,
  RECORD_STATS_GROUP_BY_SQL,
  RECORD_STATS_VIEW_SQL,
  backfillRangeSql,
  foldDeltasSql,
  parseCursor,
} from './20261101T000000000Z-record-events-stats-incremental-tables.js'

// Contract step: serve record_events_stats from record_events_stats_live,
// which 20261101T000000000Z added and the daemon's RecordEventsStatsWorker
// keeps current, instead of refreshing a materialized view that re-aggregates
// all of moderation_event.
//
// - record_events_stats becomes a plain view over the live table, keeping the
//   relation name and columns readers use.
// - account_record_events_stats keeps its query and stays a materialized view
//   refreshed by the daemon, but is rebuilt over the live table.
//
// The live table must be complete first. Up to INLINE_BACKFILL_MAX_IDS
// remaining event ids are backfilled inline, which covers deployments that
// apply both migrations in one batch (while 20261101T000000000Z's trigger
// lock still blocks moderation_event writes). Beyond that, run the expand
// release's daemon until the backfill is done, then retry. Pending deltas are
// then folded once, so the view starts current.
//
// Build-then-swap as in 20260720T000000000Z: the new account view is built
// under a _new name holding only share locks on its source, and exclusive
// locks are only taken for the final drop, create and rename. lock_timeout
// bounds how long readers can queue behind them: if a concurrent REFRESH
// holds a view (stop the refresher daemon first on large deployments), the
// migration aborts, rolls back fully, and can be re-run.
//
// What a large deployment runs once its daemon has finished the backfill is
// exported as plain strings, free of bind parameters, so it can run the same
// steps by hand.

export const INLINE_BACKFILL_MAX_IDS = 1_000_000

export const LOCK_BACKFILL_CURSOR_SQL = `SELECT cursor FROM job_cursor
WHERE job = '${RECORD_EVENTS_STATS_BACKFILL_JOB}'
FOR UPDATE`

// The backfill and fold below each upsert in key order, but this transaction
// holds the rows of both, so a worker fold between them could deadlock with
// it. This waits for a running fold and holds off the rest until commit.
export const LOCK_LIVE_TABLE_SQL = `LOCK TABLE record_events_stats_live IN SHARE ROW EXCLUSIVE MODE`

export const FOLD_DELTAS_SQL = foldDeltasSql()

// A leftover from manual work would collide with the build below.
export const DROP_LEFTOVER_ACCOUNT_STATS_SQL = `DROP MATERIALIZED VIEW IF EXISTS account_record_events_stats_new`

export const CREATE_ACCOUNT_STATS_SQL = `CREATE MATERIALIZED VIEW account_record_events_stats_new AS
${ACCOUNT_STATS_SELECT_SQL}`

export const ACCOUNT_STATS_INDEX_SQL: string[] = [
  `CREATE UNIQUE INDEX account_record_events_stats_did_idx_new
ON account_record_events_stats_new ("subjectDid")`,
  `CREATE INDEX account_record_events_stats_reported_count_idx_new
ON account_record_events_stats_new ("reportedCount" ASC NULLS FIRST, "subjectDid")`,
]

// The account view depends on record_events_stats, so goes first.
export const DROP_MATERIALIZED_VIEWS_SQL: string[] = [
  `DROP MATERIALIZED VIEW account_record_events_stats`,
  `DROP MATERIALIZED VIEW record_events_stats`,
]

// Run after RECORD_STATS_VIEW_SQL, which replaces record_events_stats.
export const RENAME_ACCOUNT_STATS_SQL: string[] = [
  `ALTER MATERIALIZED VIEW account_record_events_stats_new RENAME TO account_record_events_stats`,
  `ALTER INDEX account_record_events_stats_did_idx_new RENAME TO account_record_events_stats_did_idx`,
  `ALTER INDEX account_record_events_stats_reported_count_idx_new RENAME TO account_record_events_stats_reported_count_idx`,
]

export async function up(db: Kysely<any>): Promise<void> {
  await upWithInlineBackfillMax(db, INLINE_BACKFILL_MAX_IDS)
}

// up() with the inline backfill limit as a parameter, for tests. The
// migration provider passes up() a second argument of its own.
export async function upWithInlineBackfillMax(
  db: Kysely<any>,
  inlineBackfillMaxIds: number,
): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  await finishBackfill(db, inlineBackfillMaxIds)
  await sql.raw(FOLD_DELTAS_SQL).execute(db)

  // Build phase: no locks on the live views.
  await sql.raw(DROP_LEFTOVER_ACCOUNT_STATS_SQL).execute(db)
  await sql.raw(CREATE_ACCOUNT_STATS_SQL).execute(db)
  for (const statement of ACCOUNT_STATS_INDEX_SQL) {
    await sql.raw(statement).execute(db)
  }

  // Swap phase
  for (const statement of DROP_MATERIALIZED_VIEWS_SQL) {
    await sql.raw(statement).execute(db)
  }
  await sql.raw(RECORD_STATS_VIEW_SQL).execute(db)
  for (const statement of RENAME_ACCOUNT_STATS_SQL) {
    await sql.raw(statement).execute(db)
  }
}

// Leaves the cursor done, holding its row and the live table locked.
async function finishBackfill(
  db: Kysely<any>,
  inlineBackfillMaxIds: number,
): Promise<void> {
  const { rows } = await sql
    .raw<{ cursor: string | null }>(LOCK_BACKFILL_CURSOR_SQL)
    .execute(db)
  const cursor = parseCursor(rows[0]?.cursor ?? null)
  const { watermark, next } = cursor
  const remaining = cursor.done ? 0 : Math.max(watermark - next, 0)
  if (remaining > inlineBackfillMaxIds) {
    throw new Error(
      `record_events_stats_live is not backfilled yet: ${remaining} event ids up to ${watermark} remain, more than the ${inlineBackfillMaxIds} this migration backfills inline. Run the daemon of the release that added the ${RECORD_EVENTS_STATS_BACKFILL_JOB} job until its cursor is done, then retry.`,
    )
  }

  await sql.raw(LOCK_LIVE_TABLE_SQL).execute(db)
  if (cursor.done) return
  if (remaining > 0) {
    await sql.raw(backfillRangeSql(next, watermark)).execute(db)
  }
  await db
    .updateTable('job_cursor')
    .set({ cursor: JSON.stringify({ watermark, next: watermark, done: true }) })
    .where('job', '=', RECORD_EVENTS_STATS_BACKFILL_JOB)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  // Restore the materialized views per 20260720T000000000Z. The live and delta
  // tables, triggers and cursor stay: they belong to 20261101T000000000Z, and
  // the worker keeps folding into the table.
  await sql
    .raw(
      `CREATE MATERIALIZED VIEW record_events_stats_new AS
${RECORD_STATS_AGGREGATE_SQL}
${RECORD_STATS_GROUP_BY_SQL}`,
    )
    .execute(db)

  // Final name directly: the plain view has no indexes
  await sql`CREATE UNIQUE INDEX record_events_stats_did_key_idx ON record_events_stats_new ("subjectDid", "subjectKey")`.execute(
    db,
  )

  await sql
    .raw(
      CREATE_ACCOUNT_STATS_SQL.replace(
        'FROM record_events_stats_live',
        'FROM record_events_stats_new',
      ),
    )
    .execute(db)
  for (const statement of ACCOUNT_STATS_INDEX_SQL) {
    await sql.raw(statement).execute(db)
  }

  // Swap phase
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').execute()

  await sql`ALTER MATERIALIZED VIEW record_events_stats_new RENAME TO record_events_stats`.execute(
    db,
  )
  for (const statement of RENAME_ACCOUNT_STATS_SQL) {
    await sql.raw(statement).execute(db)
  }
}
