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
  APPEAL_REASON_TYPE,
  PUBLIC_EVENT_ACTIONS,
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
      .selectFrom('report')
      .where('did', '=', did)
      .where('recordPath', 'in', paths)
      .where('subjectMessageId', 'is', null)
      .where('subjectConvoId', 'is', null)
      .where('reportType', '=', APPEAL_REASON_TYPE)
      .distinctOn('recordPath')
      .select(['id', 'recordPath', 'status', 'createdAt', 'closedAt'])
      .orderBy('recordPath')
      .orderBy('id', 'desc')
      .execute(),
    loadPolicyList(db, serviceDid),
  ])
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
        latestAppealableAt: row.latestAppealableAt,
        appealReport,
      },
    })
    return view ? [view] : []
  })
}
