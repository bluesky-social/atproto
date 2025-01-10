import { Kysely, sql } from 'kysely'

import { REASONAPPEAL } from '../../lexicon/types/com/atproto/moderation/defs'
import { DatabaseSchemaType } from '../schema'

import {
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../../lexicon/types/tools/ozone/moderation/defs'
import * as modEvent from '../schema/moderation_event'
import * as modStatus from '../schema/moderation_subject_status'
import * as recordEventsStats from '../schema/record_events_stats'

export async function up(db: Kysely<any>): Promise<void> {
  // ~6sec for 16M events
  await db.schema
    .createView('account_events_stats')
    .materialized()
    .ifNotExists()
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

  // TODO try/catch to ignore existing
  await db.schema
    .createIndex('account_events_stats_did_idx')
    // .ifNotExists() // REquires newer version of kysely
    .unique()
    .on('account_events_stats')
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
    .createIndex('record_events_stats_uri_idx')
    // .ifNotExists()
    .unique()
    .on('record_events_stats')
    .column('subjectUri')
    .execute()

  await db.schema
    .createIndex('record_events_stats_did_idx')
    // .ifNotExists()
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
          (eb) => sql<number>`SUM(${eb.ref('reportCount')})`.as('totalReports'),
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
    // .ifNotExists()
    .unique()
    .on('account_record_events_stats')
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
    .createIndex('account_record_status_stats_did_idx')
    // .ifNotExists()
    .unique()
    .on('account_record_status_stats')
    .column('did')
    .execute()
}

export async function down(db: Kysely<DatabaseSchemaType>): Promise<void> {
  db.schema.dropView('account_record_status_stats').materialized().execute()
  db.schema.dropView('account_record_events_stats').materialized().execute()
  db.schema.dropView('record_events_stats').materialized().execute()
  db.schema.dropView('account_events_stats').materialized().execute()
}
