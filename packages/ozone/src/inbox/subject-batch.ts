import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  currentDatetimeString,
} from '@atproto/lex'
import type { InboxConfig } from '../config/config.js'
import type { Database } from '../db/index.js'
import { com } from '../lexicons/index.js'
import { subjectFromStatusRow } from '../mod-service/subject.js'
import {
  appealActivityOutcome,
  appealReportSelection,
  appealResolutionFilter,
} from './appeal-outcome.js'
import {
  PUBLIC_EVENT_ACTIONS,
  appealReportTypeFilter,
  appealableEventFilter,
  eligibilityFromCandidates,
  hasKnownLatestAppealable,
  subjectLabelUri,
} from './appeal.js'
import { loadPolicyList } from './policies.js'
import type { ActionedSubjectRow } from './subjects.js'
import { publicEventSelection, toSubjectView } from './views.js'

/** Hydrate a page belonging to one DID with a fixed number of queries. */
export async function hydrateSubjectViews(
  db: Database,
  did: DidString,
  rows: ActionedSubjectRow[],
  serviceDid: DidString,
  cfg: InboxConfig,
  seenAt: DatetimeString | null,
) {
  if (!rows.length) return []
  const subjects = rows.map(subjectFromStatusRow)
  const uris = subjects.map(subjectLabelUri)
  const paths = rows.map((row) => row.recordPath)
  const [labels, events, appeals, policyList] = await Promise.all([
    db.db
      .selectFrom('label')
      .where('uri', 'in', uris)
      .where('neg', '=', false)
      .where((eb) =>
        eb.or([eb('exp', 'is', null), eb('exp', '>', currentDatetimeString())]),
      )
      .select(['uri', 'val'])
      .execute(),
    // @NOTE Rank in SQL so the application only receives 50 events per
    // subject. Filtering the DID first reuses the existing subject index.
    db.db
      .selectFrom(
        db.db
          .selectFrom('moderation_event')
          .where('subjectDid', '=', did)
          .where('subjectType', 'in', [
            com.atproto.admin.defs.repoRef.$type,
            com.atproto.repo.strongRef.$type,
          ])
          .where(
            sql<boolean>`coalesce("subjectUri", "subjectDid") IN (${sql.join(uris)})`,
          )
          .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
          .$if(cfg.startAt !== undefined, (qb) =>
            qb.where('createdAt', '>=', cfg.startAt!),
          )
          .select(publicEventSelection)
          .select(
            sql<number>`row_number() over (partition by "subjectType", "subjectUri" order by id desc)`.as(
              'position',
            ),
          )
          .as('events'),
      )
      .selectAll()
      .where('position', '<=', 50)
      .execute(),
    db.db
      // @NOTE LIMIT each indexed subject lookup before resolving its outcome;
      // DISTINCT ON would evaluate outcomes for every historical appeal.
      .selectFrom(
        sql<{ recordPath: string }>`(
          SELECT DISTINCT unnest(${paths}::text[]) AS "recordPath"
        )`.as('subjects'),
      )
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('report')
            .where('did', '=', did)
            .whereRef('recordPath', '=', 'subjects.recordPath')
            .where('subjectMessageId', 'is', null)
            .where('subjectConvoId', 'is', null)
            .where(appealReportTypeFilter)
            .where(sql<boolean>`status <> 'closed'`)
            .orderBy('id', 'desc')
            .limit(1)
            .select('report.id')
            .as('active'),
        (join) => join.onTrue(),
      )
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('report')
            .where('did', '=', did)
            .whereRef('recordPath', '=', 'subjects.recordPath')
            .where('subjectMessageId', 'is', null)
            .where('subjectConvoId', 'is', null)
            .where(appealReportTypeFilter)
            .where(sql<boolean>`status = 'closed'`)
            .orderBy(sql`"closedAt" DESC NULLS FIRST`)
            .orderBy('id', 'desc')
            .limit(1)
            .select(['report.id', 'report.closedAt'])
            .as('closed'),
        (join) => join.onTrue(),
      )
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('report')
            .where('id', '=', sql<number>`coalesce(active.id, closed.id)`)
            .select(
              appealReportSelection.map(
                (column) => `report.${column}` as const,
              ),
            )
            .limit(1)
            .as('report'),
        (join) => join.onTrue(),
      )
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('report_activity')
            .where('report.status', '=', 'closed')
            .whereRef('reportId', '=', 'report.id')
            .where('activityType', '=', 'closeActivity')
            .whereRef('createdAt', '=', 'report.closedAt')
            .orderBy('id', 'desc')
            .limit(1)
            .select(['id', 'activityType', 'meta'])
            .as('closure'),
        (join) => join.onTrue(),
      )
      .leftJoin('moderation_event as resolution', (join) =>
        join.on(appealResolutionFilter('report', 'closure')),
      )
      .select([
        'report.id',
        'report.recordPath',
        'report.status',
        'report.createdAt',
        'report.updatedAt',
        'report.closedAt',
        'active.id as activeId',
        'closed.id as closedId',
        'closed.closedAt as lastClosedAt',
      ])
      .select(appealActivityOutcome('report', 'closure').as('outcome'))
      .orderBy('report.recordPath')
      .execute(),
    loadPolicyList(db, serviceDid),
  ])
  const fallbackUris = rows.flatMap((row, i) => {
    const subjectEvents = events.filter(
      (event) => (event.subjectUri ?? did) === uris[i],
    )
    return hasKnownLatestAppealable(row.latestAppealableAt, subjectEvents)
      ? []
      : [uris[i]]
  })
  const latestByUri = fallbackUris.length
    ? await db.db
        .selectFrom('moderation_event')
        .where('subjectDid', '=', did)
        .where('subjectType', 'in', [
          com.atproto.admin.defs.repoRef.$type,
          com.atproto.repo.strongRef.$type,
        ])
        .where(
          sql<boolean>`coalesce("subjectUri", "subjectDid") IN (${sql.join(fallbackUris)})`,
        )
        .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
        .where(appealableEventFilter)
        .$if(cfg.startAt !== undefined, (qb) =>
          qb.where('createdAt', '>=', cfg.startAt!),
        )
        .select(sql<string>`coalesce("subjectUri", "subjectDid")`.as('uri'))
        .select(sql<DatetimeString>`max("createdAt")`.as('createdAt'))
        .groupBy(sql`coalesce("subjectUri", "subjectDid")`)
        .execute()
    : []
  return rows.flatMap((row, i) => {
    const subject = subjects[i]
    const appealReport =
      appeals.find((r) => r.recordPath === row.recordPath) ?? null
    const view = toSubjectView({
      subject,
      serviceDid,
      cfg,
      seenAt,
      policyList,
      snapshot: {
        status: row,
        events: events.filter((event) => (event.subjectUri ?? did) === uris[i]),
        labels: labels
          .filter((label) => label.uri === uris[i])
          .map((label) => label.val),
        actionCount: row.actionCount,
        firstActionAt: row.firstActionAt,
        lastActionAt: row.lastActionAt,
        latestAppealableAt: fallbackUris.includes(uris[i])
          ? (latestByUri.find((entry) => entry.uri === uris[i])?.createdAt ??
            null)
          : row.latestAppealableAt,
        appealReport,
        eligibility: appealReport
          ? eligibilityFromCandidates({
              activeId: appealReport.activeId,
              closedId: appealReport.closedId,
              closedAt: appealReport.lastClosedAt,
            })
          : undefined,
      },
    })
    return view ? [view] : []
  })
}
