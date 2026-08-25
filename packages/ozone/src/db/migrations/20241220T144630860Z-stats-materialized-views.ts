import { type Kysely, sql } from 'kysely'
import { com, tools } from '../../lexicons/index.js'
import type * as modEvent from '../schema/moderation_event.js'
import type * as modStatus from '../schema/moderation_subject_status.js'
import type * as recordEventsStats from '../schema/record_events_stats.js'

export async function up(db: Kysely<any>): Promise<void> {
  // Used by "tools.ozone.moderation.queryStatuses". Reduces query cost by two
  // order of magnitudes when sorting using "reportedRecordsCount" or
  // "takendownRecordsCount" and filtering by "reviewState".
  await db.schema
    .createIndex('moderation_subject_status_did_id_review_state_idx')
    .on('moderation_subject_status')
    .column('did')
    .expression(sql`"id" ASC NULLS FIRST`)
    .column('reviewState')
    .execute()

  // ~6sec for 16M events
  await db.schema
    .createView('account_events_stats')
    .materialized()
    .ifNotExists()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .where('subjectType', '=', com.atproto.admin.defs.repoRef.$type)
        .where('subjectUri', 'is', null)
        .select('subjectDid')
        .select([
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventTakedown.$type}
              AND ${eb.ref('durationInHours')} IS NULL
            )`.as('takedownCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventTakedown.$type}
              AND ${eb.ref('durationInHours')} IS NOT NULL
            )`.as('suspendCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventEscalate.$type}
            )`.as('escalateCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type}
              AND ${eb.ref('meta')} ->> 'reportType' != ${com.atproto.moderation.defs.ReasonAppeal}
            )`.as('reportCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type}
              AND ${eb.ref('meta')} ->> 'reportType' = ${com.atproto.moderation.defs.ReasonAppeal}
            )`.as('appealCount'),
        ])
        .groupBy('subjectDid'),
    )
    .execute()

  await db.schema
    .createIndex('account_events_stats_did_idx')
    .unique()
    .on('account_events_stats')
    .column('subjectDid')
    .execute()

  await db.schema
    .createIndex('account_events_stats_suspend_count_idx')
    .on('account_events_stats')
    .expression(sql`"suspendCount" ASC NULLS FIRST`)
    .column('subjectDid')
    .execute()

  // ~50sec for 16M events
  await db.schema
    .createView('record_events_stats')
    .materialized()
    .ifNotExists()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .select([
          'subjectDid',
          'subjectUri',
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventEscalate.$type})`.as(
              'escalateCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type} AND ${eb.ref('meta')} ->> 'reportType' != ${com.atproto.moderation.defs.ReasonAppeal})`.as(
              'reportCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = ${tools.ozone.moderation.defs.modEventReport.$type} AND ${eb.ref('meta')} ->> 'reportType' = ${com.atproto.moderation.defs.ReasonAppeal})`.as(
              'appealCount',
            ),
        ])
        .where('subjectType', '=', com.atproto.repo.strongRef.$type)
        .where('subjectUri', 'is not', null)
        .groupBy(['subjectDid', 'subjectUri']),
    )
    .execute()

  await db.schema
    .createIndex('record_events_stats_uri_idx')
    .unique()
    .on('record_events_stats')
    .column('subjectUri')
    .execute()

  await db.schema
    .createIndex('record_events_stats_did_idx')
    .on('record_events_stats')
    .column('subjectDid')
    .execute()

  await db.schema
    .createView('account_record_events_stats')
    .materialized()
    .ifNotExists()
    .as(
      (db as Kysely<recordEventsStats.PartialDB>)
        .selectFrom('record_events_stats')
        .select([
          'subjectDid',
          (eb) =>
            // Casting to "bigint" because "numeric" gets casted to a string
            // by default by postgres-node.
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
    .createIndex('account_record_events_stats_did_idx')
    .unique()
    .on('account_record_events_stats')
    .column('subjectDid')
    .execute()

  await db.schema
    .createIndex('account_record_events_stats_reported_count_idx')
    .on('account_record_events_stats')
    .expression(sql`"reportedCount" ASC NULLS FIRST`)
    .column('subjectDid')
    .execute()

  await db.schema
    .createView('account_record_status_stats')
    .materialized()
    .ifNotExists()
    .as(
      (db as Kysely<modStatus.PartialDB>)
        .selectFrom('moderation_subject_status')
        .select('did')
        .select([
          sql<number>`COUNT(*)`.as('subjectCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} IN (${tools.ozone.moderation.defs.ReviewOpen}, ${tools.ozone.moderation.defs.ReviewEscalated}))`.as(
              'pendingCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('reviewState')} NOT IN (${tools.ozone.moderation.defs.ReviewOpen}, ${tools.ozone.moderation.defs.ReviewEscalated}))`.as(
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
    .createIndex('account_record_status_stats_did_idx')
    .unique()
    .on('account_record_status_stats')
    .column('did')
    .execute()

  await db.schema
    .createIndex('account_record_status_stats_takendown_count_idx')
    .on('account_record_status_stats')
    .expression(sql`"takendownCount" ASC NULLS FIRST`)
    .column('did')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  db.schema.dropView('account_record_status_stats').materialized().execute()
  db.schema.dropView('account_record_events_stats').materialized().execute()
  db.schema.dropView('record_events_stats').materialized().execute()
  db.schema.dropView('account_events_stats').materialized().execute()
}
