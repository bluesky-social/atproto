import { sql } from 'kysely'
import { MINUTE, SECOND } from '@atproto/common'
import type { Database } from '../db/index.js'
import { tools } from '../lexicons/index.js'
import { dbLogger } from '../logger.js'
import { initJobCursor } from './job-cursor.js'

export const REPORT_REPORTER_DID_BACKFILL_JOB = 'report_reporter_did_backfill'

const BATCH_SIZE = 1_000
const BATCHES_PER_POLL = 10

type BatchResult = {
  lastId: number | null
  scannedRows: number
  updatedRows: number
  missingSourceRows: number
  invalidSourceRows: number
}

type BackfillSummary = Omit<BatchResult, 'lastId'>

export class ReportReporterDidBackfiller {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private batchSize = BATCH_SIZE,
  ) {}

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    let interval = MINUTE
    this.processingPromise = this.processAvailable()
      .then((summary) => {
        if (summary.scannedRows > 0) {
          dbLogger.info(summary, 'report reporter DID backfill batch completed')
          interval = SECOND
        }
      })
      .catch((err) =>
        dbLogger.error({ err }, 'report reporter DID backfill errored'),
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

  async initializeCursor() {
    await initJobCursor(this.db, REPORT_REPORTER_DID_BACKFILL_JOB)
  }

  async processAll(): Promise<BackfillSummary> {
    await this.initializeCursor()
    const summary = emptySummary()
    while (true) {
      const batch = await this.processBatch()
      addSummary(summary, batch)
      if (batch.scannedRows === 0) return summary
    }
  }

  async processBatch(): Promise<BatchResult> {
    return this.db.transaction(async (txn) => {
      // Serialize cursor reads and report updates, while committing after every
      // bounded batch so the lock and row locks are released promptly.
      const cursorRow = await txn.db
        .selectFrom('job_cursor')
        .select('cursor')
        .where('job', '=', REPORT_REPORTER_DID_BACKFILL_JOB)
        .forUpdate()
        .executeTakeFirst()
      if (!cursorRow) return emptyBatch()

      const cursor = cursorRow.cursor
        ? Number.parseInt(cursorRow.cursor, 10)
        : 0
      const result = await sql<BatchResult>`
        WITH batch AS MATERIALIZED (
          SELECT r.id, r."eventId", r."reporterDid"
          FROM report AS r
          WHERE r.id > ${cursor}
          ORDER BY r.id ASC
          LIMIT ${this.batchSize}
        ), source AS MATERIALIZED (
          SELECT
            b.id,
            b."reporterDid",
            me.id AS "sourceEventId",
            me.action,
            me."createdBy"
          FROM batch AS b
          LEFT JOIN moderation_event AS me ON me.id = b."eventId"
        ), updated AS (
          UPDATE report AS r
          SET "reporterDid" = source."createdBy"
          FROM source
          WHERE r.id = source.id
            AND r."reporterDid" IS NULL
            AND source.action = ${tools.ozone.moderation.defs.modEventReport.$type}
          RETURNING r.id
        )
        SELECT
          (SELECT max(id)::int FROM batch) AS "lastId",
          (SELECT count(*)::int FROM batch) AS "scannedRows",
          (SELECT count(*)::int FROM updated) AS "updatedRows",
          count(*) FILTER (
            WHERE source."reporterDid" IS NULL
              AND source."sourceEventId" IS NULL
          )::int AS "missingSourceRows",
          count(*) FILTER (
            WHERE source."reporterDid" IS NULL
              AND source."sourceEventId" IS NOT NULL
              AND source.action IS DISTINCT FROM ${tools.ozone.moderation.defs.modEventReport.$type}
          )::int AS "invalidSourceRows"
        FROM source
      `.execute(txn.db)

      const batch = result.rows[0] ?? emptyBatch()
      if (batch.lastId !== null) {
        await txn.db
          .updateTable('job_cursor')
          .set({ cursor: String(batch.lastId) })
          .where('job', '=', REPORT_REPORTER_DID_BACKFILL_JOB)
          .execute()
      }
      return batch
    })
  }

  private async processAvailable(): Promise<BackfillSummary> {
    await this.initializeCursor()
    const summary = emptySummary()
    for (let i = 0; i < BATCHES_PER_POLL; i++) {
      const batch = await this.processBatch()
      addSummary(summary, batch)
      if (batch.scannedRows === 0) break
    }
    return summary
  }
}

function emptyBatch(): BatchResult {
  return {
    lastId: null,
    scannedRows: 0,
    updatedRows: 0,
    missingSourceRows: 0,
    invalidSourceRows: 0,
  }
}

function emptySummary(): BackfillSummary {
  return {
    scannedRows: 0,
    updatedRows: 0,
    missingSourceRows: 0,
    invalidSourceRows: 0,
  }
}

function addSummary(summary: BackfillSummary, batch: BatchResult) {
  summary.scannedRows += batch.scannedRows
  summary.updatedRows += batch.updatedRows
  summary.missingSourceRows += batch.missingSourceRows
  summary.invalidSourceRows += batch.invalidSourceRows
}
