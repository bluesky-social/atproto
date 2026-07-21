import { type Kysely, sql } from 'kysely'
import { OZONE_APPEAL_REASON_TYPE } from '../../api/util.js'
import { REASONAPPEAL } from '../../lexicon/types/com/atproto/moderation/defs.js'
import {
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../../lexicon/types/tools/ozone/moderation/defs.js'
import type * as modEvent from '../schema/moderation_event.js'
import type * as modStatus from '../schema/moderation_subject_status.js'
import type * as recordEventsStats from '../schema/record_events_stats.js'

// Recreate stats materialized views to include conversation subjects.
//
// - record_events_stats: convoRef/messageRef events have no subjectUri, so
//   subjects are now keyed by COALESCE(subjectUri, convoId) as "subjectKey".
//   Message events aggregate under their convoId, matching how
//   moderation_subject_status keys them (did, recordPath: '', convoId). The
//   convoId comes from "subjectConvoId", falling back to meta->>'convoId' for
//   events that predate the column. Unlike at-uris, convoIds don't embed the
//   did (every convo member shares one), so the unique index required by
//   REFRESH CONCURRENTLY moves from (subjectUri) to (subjectDid, subjectKey).
// - account_record_events_stats: unchanged query, but must be rebuilt because
//   it depends on record_events_stats.
// - account_record_status_stats: convo statuses have recordPath = '' and
//   convoId != '', so the filter now accepts either.
// - account_events_stats is untouched (repoRef events only).
//
// The replacement views are built under *_new names and swapped in via
// rename. Building takes minutes at scale but only holds share locks on the
// base tables, so the live views keep serving queryStatuses (which joins them
// on every call). Exclusive locks are only needed for the final drop+rename,
// and lock_timeout bounds how long readers can queue behind them: if a
// concurrent REFRESH holds a view (stop the refresher daemon first on large
// deployments), the migration aborts, rolls back fully, and can be re-run.

const convoId = sql`COALESCE(NULLIF(${sql.ref('subjectConvoId')}, ''), NULLIF(${sql.ref('meta')} ->> 'convoId', ''))`
const subjectKey = sql`COALESCE(${sql.ref('subjectUri')}, ${convoId})`

export async function up(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  // Leftovers from prior manual swaps of these views may still own the
  // canonical index names; clear them so the renames below can't collide.
  await db.schema
    .dropView('account_record_events_stats_old')
    .materialized()
    .ifExists()
    .execute()
  await db.schema
    .dropView('record_events_stats_old')
    .materialized()
    .ifExists()
    .execute()
  await db.schema
    .dropView('account_record_status_stats_old')
    .materialized()
    .ifExists()
    .execute()

  // Build phase: no locks on the live views.
  await db.schema
    .createView('record_events_stats_new')
    .materialized()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .select([
          'subjectDid',
          () => subjectKey.as('subjectKey'),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventEscalate')`.as(
              'escalateCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' NOT IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
              'reportCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
              'appealCount',
            ),
        ])
        .where((eb) =>
          eb.or([
            eb.and([
              eb('subjectType', '=', 'com.atproto.repo.strongRef'),
              eb('subjectUri', 'is not', null),
            ]),
            eb.and([
              eb('subjectType', 'in', [
                'chat.bsky.convo.defs#convoRef',
                'chat.bsky.convo.defs#messageRef',
              ]),
              sql<boolean>`${convoId} IS NOT NULL`,
            ]),
          ]),
        )
        .groupBy(['subjectDid', subjectKey]),
    )
    .execute()

  // Final name directly: doesn't collide with the old view's uri/did indexes
  await db.schema
    .createIndex('record_events_stats_did_key_idx')
    .unique()
    .on('record_events_stats_new')
    .columns(['subjectDid', 'subjectKey'])
    .execute()

  await db.schema
    .createView('account_record_events_stats_new')
    .materialized()
    .as(
      (
        db as Kysely<{
          record_events_stats_new: recordEventsStats.RecordEventsStats
        }>
      )
        .selectFrom('record_events_stats_new')
        .select([
          'subjectDid',
          (eb) =>
            sql<number>`SUM(${eb.ref('reportCount')})::bigint`.as(
              'totalReports',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reportCount')} > 0)`.as(
              'reportedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('escalateCount')} > 0)`.as(
              'escalatedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('appealCount')} > 0)`.as(
              'appealedCount',
            ),
        ])
        .groupBy('subjectDid'),
    )
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

  await db.schema
    .createView('account_record_status_stats_new')
    .materialized()
    .as(
      (db as Kysely<modStatus.PartialDB>)
        .selectFrom('moderation_subject_status')
        .select('did')
        .select([
          sql<number>`COUNT(*)`.as('subjectCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} IN (${REVIEWOPEN}, ${REVIEWESCALATED}))`.as(
              'pendingCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} NOT IN (${REVIEWOPEN}, ${REVIEWESCALATED}))`.as(
              'processedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('takendown')})`.as(
              'takendownCount',
            ),
        ])
        .where((eb) =>
          eb.or([eb('recordPath', '!=', ''), eb('convoId', '!=', '')]),
        )
        .groupBy('did'),
    )
    .execute()

  await db.schema
    .createIndex('account_record_status_stats_did_idx_new')
    .unique()
    .on('account_record_status_stats_new')
    .column('did')
    .execute()

  await db.schema
    .createIndex('account_record_status_stats_takendown_count_idx_new')
    .on('account_record_status_stats_new')
    .expression(sql`"takendownCount" ASC NULLS FIRST`)
    .column('did')
    .execute()

  // Swap phase: exclusive locks held for milliseconds.
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').materialized().execute()
  await db.schema
    .dropView('account_record_status_stats')
    .materialized()
    .execute()

  await sql`ALTER MATERIALIZED VIEW "record_events_stats_new" RENAME TO "record_events_stats"`.execute(
    db,
  )
  await sql`ALTER MATERIALIZED VIEW "account_record_events_stats_new" RENAME TO "account_record_events_stats"`.execute(
    db,
  )
  await sql`ALTER MATERIALIZED VIEW "account_record_status_stats_new" RENAME TO "account_record_status_stats"`.execute(
    db,
  )

  await sql`ALTER INDEX "account_record_events_stats_did_idx_new" RENAME TO "account_record_events_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_reported_count_idx_new" RENAME TO "account_record_events_stats_reported_count_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_status_stats_did_idx_new" RENAME TO "account_record_status_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_status_stats_takendown_count_idx_new" RENAME TO "account_record_status_stats_takendown_count_idx"`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)

  // Restore the record-only views (per 20250718T150931000Z &
  // 20241220T144630860Z), same build-then-swap mechanics as up().
  await db.schema
    .createView('record_events_stats_new')
    .materialized()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .select([
          'subjectDid',
          'subjectUri',
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventEscalate')`.as(
              'escalateCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' NOT IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
              'reportCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE}))`.as(
              'appealCount',
            ),
        ])
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', 'is not', null)
        .groupBy(['subjectDid', 'subjectUri']),
    )
    .execute()

  // Final names directly: the live view only owns record_events_stats_did_key_idx
  await db.schema
    .createIndex('record_events_stats_uri_idx')
    .unique()
    .on('record_events_stats_new')
    .column('subjectUri')
    .execute()

  await db.schema
    .createIndex('record_events_stats_did_idx')
    .on('record_events_stats_new')
    .column('subjectDid')
    .execute()

  await db.schema
    .createView('account_record_events_stats_new')
    .materialized()
    .as(
      (
        db as Kysely<{
          record_events_stats_new: recordEventsStats.RecordEventsStats
        }>
      )
        .selectFrom('record_events_stats_new')
        .select([
          'subjectDid',
          (eb) =>
            sql<number>`SUM(${eb.ref('reportCount')})::bigint`.as(
              'totalReports',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reportCount')} > 0)`.as(
              'reportedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('escalateCount')} > 0)`.as(
              'escalatedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('appealCount')} > 0)`.as(
              'appealedCount',
            ),
        ])
        .groupBy('subjectDid'),
    )
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

  await db.schema
    .createView('account_record_status_stats_new')
    .materialized()
    .as(
      (db as Kysely<modStatus.PartialDB>)
        .selectFrom('moderation_subject_status')
        .select('did')
        .select([
          sql<number>`COUNT(*)`.as('subjectCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} IN (${REVIEWOPEN}, ${REVIEWESCALATED}))`.as(
              'pendingCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} NOT IN (${REVIEWOPEN}, ${REVIEWESCALATED}))`.as(
              'processedCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('takendown')})`.as(
              'takendownCount',
            ),
        ])
        .where('recordPath', '!=', '')
        .groupBy('did'),
    )
    .execute()

  await db.schema
    .createIndex('account_record_status_stats_did_idx_new')
    .unique()
    .on('account_record_status_stats_new')
    .column('did')
    .execute()

  await db.schema
    .createIndex('account_record_status_stats_takendown_count_idx_new')
    .on('account_record_status_stats_new')
    .expression(sql`"takendownCount" ASC NULLS FIRST`)
    .column('did')
    .execute()

  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').materialized().execute()
  await db.schema
    .dropView('account_record_status_stats')
    .materialized()
    .execute()

  await sql`ALTER MATERIALIZED VIEW "record_events_stats_new" RENAME TO "record_events_stats"`.execute(
    db,
  )
  await sql`ALTER MATERIALIZED VIEW "account_record_events_stats_new" RENAME TO "account_record_events_stats"`.execute(
    db,
  )
  await sql`ALTER MATERIALIZED VIEW "account_record_status_stats_new" RENAME TO "account_record_status_stats"`.execute(
    db,
  )

  await sql`ALTER INDEX "account_record_events_stats_did_idx_new" RENAME TO "account_record_events_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_events_stats_reported_count_idx_new" RENAME TO "account_record_events_stats_reported_count_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_status_stats_did_idx_new" RENAME TO "account_record_status_stats_did_idx"`.execute(
    db,
  )
  await sql`ALTER INDEX "account_record_status_stats_takendown_count_idx_new" RENAME TO "account_record_status_stats_takendown_count_idx"`.execute(
    db,
  )
}
