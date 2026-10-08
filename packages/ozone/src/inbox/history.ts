import { sql } from 'kysely'
import type { DatetimeString } from '@atproto/lex'
import { DEFAULT_INBOX_POLICY_URL } from '../config/config.js'
import type { Database } from '../db/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import {
  LABEL,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  TAKEDOWN,
  eventSubjectFilter,
} from './appeal.js'
import type { PolicyList } from './policies.js'
import { inboxHasStarted } from './start.js'
import {
  type PublicEventRow,
  publicEventSelection,
  toActionView,
} from './views.js'

/** Page public actions, including reversals outside the requested page. */
export async function queryActionHistory(
  db: Database,
  subject: ModSubject,
  limit: number,
  before?: { sortValue: DatetimeString; id: number },
  policyList: PolicyList = {},
  defaultPolicyUrl?: string,
  startAt?: DatetimeString,
) {
  if (!inboxHasStarted(startAt)) return { actions: [], cursor: undefined }
  const events = db.db
    .selectFrom('moderation_event')
    .where((eb) => eventSubjectFilter(eb, subject))
    .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
    .$if(startAt !== undefined, (qb) => qb.where('createdAt', '>=', startAt!))
    .select(publicEventSelection)
  // @NOTE Pairing happens before pagination. Window functions keep the
  // subject's history in PostgreSQL; at most limit + 1 rows leave the DB.
  // The reflected balance models the takedown stack, ignoring unmatched
  // reversals. Labels pair each application with its next change per value.
  const result = await sql<
    PublicEventRow & { reversedAt: DatetimeString | null }
  >`
    WITH events AS MATERIALIZED (${events}),
    balances AS (
      SELECT id, action, "createdAt",
        sum(CASE WHEN action = ${TAKEDOWN} THEN 1 ELSE -1 END)
          OVER (ORDER BY "createdAt", id) AS balance
      FROM events WHERE action IN (${TAKEDOWN}, ${REVERSE_TAKEDOWN})
    ), depths AS (
      SELECT *, balance - least(0, min(balance) OVER (ORDER BY "createdAt", id)) AS depth
      FROM balances
    ), takedowns AS (
      SELECT id, action,
        lead(action) OVER pairing AS "nextAction",
        lead("createdAt") OVER pairing AS "nextAt"
      FROM depths
      WINDOW pairing AS (
        PARTITION BY CASE WHEN action = ${TAKEDOWN} THEN depth ELSE depth + 1 END
        ORDER BY "createdAt", id
      )
    ), label_ops AS (
      SELECT id, "createdAt", 0 AS phase, unnest(string_to_array("negateLabelVals", ' ')) AS val
      FROM events WHERE action = ${LABEL}
      UNION ALL
      SELECT id, "createdAt", 1 AS phase, unnest(string_to_array("createLabelVals", ' ')) AS val
      FROM events WHERE action = ${LABEL}
    ), label_pairs AS (
      SELECT *, lead(phase) OVER pairing AS "nextPhase", lead("createdAt") OVER pairing AS "nextAt"
      FROM label_ops
      WINDOW pairing AS (PARTITION BY val ORDER BY "createdAt", id, phase)
    ), labels AS (
      SELECT id, max("nextAt") AS "reversedAt" FROM label_pairs
      WHERE phase = 1 AND "nextPhase" = 0 AND val NOT IN ('!takedown', '!suspend', '')
      GROUP BY id
    )
    SELECT e.*, CASE WHEN e.action = ${TAKEDOWN} AND t."nextAction" = ${REVERSE_TAKEDOWN}
      THEN t."nextAt" ELSE l."reversedAt" END AS "reversedAt"
    FROM events e LEFT JOIN takedowns t ON t.id = e.id LEFT JOIN labels l ON l.id = e.id
    WHERE e.action <> ${REVERSE_TAKEDOWN}
      ${before ? sql`AND (e."createdAt", e.id) < (${before.sortValue}, ${before.id})` : sql``}
    ORDER BY e."createdAt" DESC, e.id DESC LIMIT ${limit + 1}
  `.execute(db.db)
  const page = result.rows.slice(0, limit)
  const last = page.at(-1)
  return {
    actions: page.flatMap((row) => {
      const view = toActionView(
        row,
        policyList,
        defaultPolicyUrl ?? DEFAULT_INBOX_POLICY_URL,
      )
      if (!view) return []
      if (row.reversedAt) view.reversedAt = row.reversedAt
      return [view]
    }),
    cursor:
      result.rows.length > limit && last
        ? `${last.createdAt}::${last.id}`
        : undefined,
  }
}
