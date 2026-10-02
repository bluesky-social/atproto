import { type Kysely, sql } from 'kysely'

const BATCH_SIZE = 10_000
const REPORT_ACTION = 'tools.ozone.moderation.defs#modEventReport'

type BackfillBatch = {
  lastId: number | null
  updatedRows: number
  missingSourceRows: number
  invalidSourceRows: number
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // The DDL lock lasts until Kysely commits this migration transaction. Fail
  // quickly if a long-running transaction is already holding the report table.
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)
  await db.schema
    .alterTable('report')
    .addColumn('reporterDid', 'varchar')
    .execute()

  const maxResult = await sql<{ maxId: number | null }>`
    SELECT max(id)::int AS "maxId" FROM report
  `.execute(db)
  const maxId = maxResult.rows[0]?.maxId ?? null
  if (maxId === null) return

  let lastId = 0
  let updatedRows = 0
  let missingSourceRows = 0
  let invalidSourceRows = 0

  while (lastId < maxId) {
    const result = await sql<BackfillBatch>`
      WITH batch AS MATERIALIZED (
        SELECT r.id, r."eventId", r."reporterDid"
        FROM report AS r
        WHERE r.id > ${lastId} AND r.id <= ${maxId}
        ORDER BY r.id ASC
        LIMIT ${BATCH_SIZE}
      ), source AS MATERIALIZED (
        SELECT
          b.id,
          b."reporterDid",
          me.id AS "sourceEventId",
          me.action,
          me."createdBy"
        FROM batch AS b
        LEFT JOIN LATERAL (
          SELECT id, action, "createdBy"
          FROM moderation_event
          WHERE id = b."eventId"
          LIMIT 1
        ) AS me ON true
      ), updated AS (
        UPDATE report AS r
        SET "reporterDid" = source."createdBy"
        FROM source
        WHERE r.id = source.id
          AND r."reporterDid" IS NULL
          AND source.action = ${REPORT_ACTION}
        RETURNING r.id
      )
      SELECT
        (SELECT max(id)::int FROM batch) AS "lastId",
        (SELECT count(*)::int FROM updated) AS "updatedRows",
        count(*) FILTER (
          WHERE source."reporterDid" IS NULL
            AND source."sourceEventId" IS NULL
        )::int AS "missingSourceRows",
        count(*) FILTER (
          WHERE source."reporterDid" IS NULL
            AND source."sourceEventId" IS NOT NULL
            AND source.action IS DISTINCT FROM ${REPORT_ACTION}
        )::int AS "invalidSourceRows"
      FROM source
    `.execute(db)

    const batch = result.rows[0]
    if (!batch?.lastId) break

    lastId = batch.lastId
    updatedRows += batch.updatedRows
    missingSourceRows += batch.missingSourceRows
    invalidSourceRows += batch.invalidSourceRows
  }

  console.info('Report reporter DID backfill complete', {
    maxId,
    batchSize: BATCH_SIZE,
    updatedRows,
    missingSourceRows,
    invalidSourceRows,
  })
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('report').dropColumn('reporterDid').execute()
}
