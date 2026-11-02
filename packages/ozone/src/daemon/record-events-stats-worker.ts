import { type RawBuilder, sql } from 'kysely'
import { SECOND } from '@atproto/common'
import type { Database } from '../db/index.js'
import {
  RECORD_EVENTS_STATS_BACKFILL_JOB,
  RECORD_STATS_AGGREGATE_SQL,
  RECORD_STATS_GROUP_BY_SQL,
} from '../db/migrations/20261101T000000000Z-record-events-stats-incremental-tables.js'
import { dbLogger } from '../logger.js'

const BACKFILL_BATCH_IDS = 100_000
const FOLD_BATCH_ROWS = 10_000
const BATCHES_PER_POLL = 10
// Counts in record_events_stats_live lag moderation_event by up to this long,
// plus the time to fold whatever queued up meanwhile.
const IDLE_INTERVAL = 5 * SECOND

type BackfillCursor = {
  watermark: number
  next: number
  done?: true
}

export type BackfillBatch = BackfillCursor & {
  scannedIds: number
}

export type FoldBatch = {
  deltaRows: number
}

type WorkSummary = {
  backfilledIds: number
  backfillBatches: number
  foldedRows: number
  foldBatches: number
  cursor?: BackfillCursor
}

// Maintains record_events_stats_live, as its only writer: backfills it from
// moderation_event events up to the watermark set by the migration, and folds
// in the deltas the triggers queue for later events.
//
// Folding while the backfill is still running is correct: the deltas only
// cover events above the watermark, and both steps add to the counts, so the
// order they land in doesn't matter.
//
// Every write to the table upserts in subject key order, so concurrent
// batches, from this or another daemon, lock rows in the same order and can't
// deadlock.
export class RecordEventsStatsWorker {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout
  private backfillBatchIds: number
  private foldBatchRows: number

  constructor(
    private db: Database,
    opts: { backfillBatchIds?: number; foldBatchRows?: number } = {},
  ) {
    this.backfillBatchIds = opts.backfillBatchIds ?? BACKFILL_BATCH_IDS
    this.foldBatchRows = opts.foldBatchRows ?? FOLD_BATCH_ROWS
  }

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    let interval = IDLE_INTERVAL
    this.processingPromise = this.processAvailable()
      .then((summary) => {
        if (summary.backfillBatches > 0) {
          dbLogger.info(summary, 'record events stats backfill batch completed')
        } else if (summary.foldedRows > 0) {
          dbLogger.debug(summary, 'record events stats deltas folded')
        }
        if (summary.backfillBatches > 0 || summary.foldedRows > 0) {
          interval = SECOND
        }
      })
      .catch((err) =>
        dbLogger.error({ err }, 'record events stats worker errored'),
      )
      .finally(() => {
        if (!this.destroyed) {
          this.timer = setTimeout(() => this.poll(), interval)
        }
      })
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await this.processingPromise
  }

  async processAll(): Promise<WorkSummary> {
    const summary = emptySummary()
    while (true) {
      const batch = await this.processBackfillBatch()
      if (!batch) break
      addBackfill(summary, batch)
    }
    while (true) {
      const batch = await this.processFoldBatch()
      if (batch.deltaRows === 0) break
      addFold(summary, batch)
    }
    return summary
  }

  // Returns null once the backfill is done.
  async processBackfillBatch(): Promise<BackfillBatch | null> {
    // Checked without the lock first, as it is done on nearly every poll.
    if ((await this.readCursor(this.db)).done) return null
    const batch = await this.db.transaction(async (txn) => {
      // Serializes backfill batches across daemons, while committing after
      // every bounded batch so the lock is released promptly.
      const cursor = await this.readCursor(txn, true)
      if (cursor.done) return null

      const { watermark, next } = cursor
      const hi = Math.min(next + this.backfillBatchIds, watermark)
      if (hi > next) {
        await upsertLive(
          sql`${sql.raw(RECORD_STATS_AGGREGATE_SQL)} AND id > ${next} AND id <= ${hi}
          ${sql.raw(RECORD_STATS_GROUP_BY_SQL)}`,
        ).execute(txn.db)
      }

      const advanced: BackfillCursor =
        hi >= watermark
          ? { watermark, next: watermark, done: true }
          : { watermark, next: hi }
      await txn.db
        .updateTable('job_cursor')
        .set({ cursor: JSON.stringify(advanced) })
        .where('job', '=', RECORD_EVENTS_STATS_BACKFILL_JOB)
        .execute()
      return { ...advanced, scannedIds: hi - next }
    })
    if (batch?.done) {
      dbLogger.info(batch, 'record events stats backfill completed')
    }
    return batch
  }

  private async readCursor(
    db: Database,
    forUpdate = false,
  ): Promise<BackfillCursor> {
    let query = db.db
      .selectFrom('job_cursor')
      .select('cursor')
      .where('job', '=', RECORD_EVENTS_STATS_BACKFILL_JOB)
    if (forUpdate) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    return parseCursor(row?.cursor ?? null)
  }

  async processFoldBatch(): Promise<FoldBatch> {
    return this.db.transaction(async (txn) => {
      // SKIP LOCKED lets concurrent daemons fold disjoint batches.
      const result = await sql<FoldBatch>`
        WITH batch AS (
          DELETE FROM record_events_stats_delta
          WHERE id IN (
            SELECT id FROM record_events_stats_delta
            ORDER BY id
            LIMIT ${this.foldBatchRows}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING "subjectDid", "subjectKey", "escalateDelta", "reportDelta", "appealDelta"
        ), folded AS (
          ${upsertLive(sql`
            SELECT
              "subjectDid",
              "subjectKey",
              SUM("escalateDelta") AS "escalateCount",
              SUM("reportDelta") AS "reportCount",
              SUM("appealDelta") AS "appealCount"
            FROM batch
            GROUP BY "subjectDid", "subjectKey"
          `)}
        )
        SELECT count(*)::int AS "deltaRows" FROM batch
      `.execute(txn.db)
      return result.rows[0] ?? { deltaRows: 0 }
    })
  }

  private async processAvailable(): Promise<WorkSummary> {
    const summary = emptySummary()
    for (let i = 0; i < BATCHES_PER_POLL; i++) {
      const batch = await this.processBackfillBatch()
      if (!batch) break
      addBackfill(summary, batch)
    }
    for (let i = 0; i < BATCHES_PER_POLL; i++) {
      const batch = await this.processFoldBatch()
      addFold(summary, batch)
      if (batch.deltaRows < this.foldBatchRows) break
    }
    return summary
  }
}

// Adds source's per-subject counts to the table, in key order (see above).
// Rows whose counts are all zero only make sure the subject has a row: on
// conflict the WHERE skips the update, leaving the existing row as is. Doing
// this in one statement rather than a separate ON CONFLICT DO NOTHING keeps
// the whole batch in key order.
function upsertLive(source: RawBuilder<unknown>): RawBuilder<unknown> {
  return sql`
    INSERT INTO record_events_stats_live AS s
      ("subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount")
    SELECT "subjectDid", "subjectKey", "escalateCount", "reportCount", "appealCount"
    FROM (${source}) AS src
    ORDER BY "subjectDid", "subjectKey"
    ON CONFLICT ("subjectDid", "subjectKey") DO UPDATE SET
      "escalateCount" = s."escalateCount" + excluded."escalateCount",
      "reportCount" = s."reportCount" + excluded."reportCount",
      "appealCount" = s."appealCount" + excluded."appealCount"
    WHERE excluded."escalateCount" <> 0
      OR excluded."reportCount" <> 0
      OR excluded."appealCount" <> 0
  `
}

// The migration inserts the cursor; without it the backfill can't know where
// to stop, and restarting it would count events twice.
function parseCursor(cursor: string | null): BackfillCursor {
  const parsed: Partial<BackfillCursor> | null = cursor
    ? JSON.parse(cursor)
    : null
  if (
    typeof parsed?.watermark !== 'number' ||
    typeof parsed?.next !== 'number'
  ) {
    throw new Error(
      `missing or malformed ${RECORD_EVENTS_STATS_BACKFILL_JOB} job cursor: ${cursor}`,
    )
  }
  return parsed as BackfillCursor
}

function emptySummary(): WorkSummary {
  return { backfilledIds: 0, backfillBatches: 0, foldedRows: 0, foldBatches: 0 }
}

function addBackfill(summary: WorkSummary, batch: BackfillBatch) {
  summary.backfilledIds += batch.scannedIds
  summary.backfillBatches++
  summary.cursor = {
    watermark: batch.watermark,
    next: batch.next,
    ...(batch.done ? { done: true } : {}),
  }
}

function addFold(summary: WorkSummary, batch: FoldBatch) {
  if (batch.deltaRows === 0) return
  summary.foldedRows += batch.deltaRows
  summary.foldBatches++
}
