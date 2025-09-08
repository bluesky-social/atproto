import { Kysely, sql } from 'kysely'
import { OZONE_APPEAL_REASON_TYPE } from '../../api/util'
import { REASONAPPEAL } from '../../lexicon/types/com/atproto/moderation/defs'
import { DatabaseSchemaType } from '../schema'
import * as modEvent from '../schema/moderation_event'
import * as recordEventsStats from '../schema/record_events_stats'

export async function up(db: Kysely<any>): Promise<void> {
  // Drop and recreate materialized views to update appeal reason counting
  // to include both REASONAPPEAL and OZONE_APPEAL_REASON_TYPE
  // The primary difference between the old and new query is that we were using = and != operators
  // to match against the meta->>'reportType' field and now we use IN and NOT IN

  // Drop existing materialized views in reverse dependency order
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').materialized().execute()
  await db.schema.dropView('account_events_stats').materialized().execute()

  // Recreate account_events_stats with updated appeal counting
  await db.schema
    .createView('account_events_stats')
    .materialized()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where('subjectUri', 'is', null)
        .select('subjectDid')
        .select([
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventTakedown'
              AND ${eb.ref('durationInHours')} IS NULL
            )`.as('takedownCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventTakedown'
              AND ${eb.ref('durationInHours')} IS NOT NULL
            )`.as('suspendCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventEscalate'
            )`.as('escalateCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport'
              AND ${eb.ref('meta')} ->> 'reportType' NOT IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE})
            )`.as('reportCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport'
              AND ${eb.ref('meta')} ->> 'reportType' IN (${REASONAPPEAL}, ${OZONE_APPEAL_REASON_TYPE})
            )`.as('appealCount'),
        ])
        .groupBy('subjectDid'),
    )
    .execute()

  // Recreate record_events_stats with updated appeal counting
  await db.schema
    .createView('record_events_stats')
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

  // Recreate account_record_events_stats (unchanged logic, but depends on record_events_stats)
  await db.schema
    .createView('account_record_events_stats')
    .materialized()
    .as(
      (db as Kysely<recordEventsStats.PartialDB>)
        .selectFrom('record_events_stats')
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

  // Recreate all indexes for the materialized views
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
}

export async function down(db: Kysely<DatabaseSchemaType>): Promise<void> {
  // Drop the updated materialized views
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .execute()
  await db.schema.dropView('record_events_stats').materialized().execute()
  await db.schema.dropView('account_events_stats').materialized().execute()

  // Recreate the original views with single appeal reason type
  await db.schema
    .createView('account_events_stats')
    .materialized()
    .as(
      (db as Kysely<modEvent.PartialDB>)
        .selectFrom('moderation_event')
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where('subjectUri', 'is', null)
        .select('subjectDid')
        .select([
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventTakedown'
              AND ${eb.ref('durationInHours')} IS NULL
            )`.as('takedownCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventTakedown'
              AND ${eb.ref('durationInHours')} IS NOT NULL
            )`.as('suspendCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventEscalate'
            )`.as('escalateCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport'
              AND ${eb.ref('meta')} ->> 'reportType' != ${REASONAPPEAL}
            )`.as('reportCount'),
          (eb) =>
            sql<number>`COUNT(*) FILTER(
              WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport'
              AND ${eb.ref('meta')} ->> 'reportType' = ${REASONAPPEAL}
            )`.as('appealCount'),
        ])
        .groupBy('subjectDid'),
    )
    .execute()

  await db.schema
    .createView('record_events_stats')
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
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' != 'com.atproto.moderation.defs#reasonAppeal')`.as(
              'reportCount',
            ),
          (eb) =>
            sql<number>`COUNT(*) FILTER (WHERE ${eb.ref('action')} = 'tools.ozone.moderation.defs#modEventReport' AND ${eb.ref('meta')} ->> 'reportType' = 'com.atproto.moderation.defs#reasonAppeal')`.as(
              'appealCount',
            ),
        ])
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', 'is not', null)
        .groupBy(['subjectDid', 'subjectUri']),
    )
    .execute()

  await db.schema
    .createView('account_record_events_stats')
    .materialized()
    .as(
      (db as Kysely<recordEventsStats.PartialDB>)
        .selectFrom('record_events_stats')
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

  // Recreate indexes
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
}
