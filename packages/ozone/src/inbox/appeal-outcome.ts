import { type AliasedRawBuilder, type RawBuilder, sql } from 'kysely'
import { com, tools } from '../lexicons/index.js'

export type AppealOutcome = 'approved' | 'denied'

/** Derive a decision only from the closing activity and its linked action. */
export function appealActivityOutcome(
  reportAlias: 'report' | 'r',
  activityAlias: 'closure' | 'activity',
): RawBuilder<AppealOutcome | null> {
  const report = (column: string) => sql.ref(`${reportAlias}.${column}`)
  const activity = (column: string) => sql.ref(`${activityAlias}.${column}`)
  return sql<AppealOutcome | null>`CASE
    WHEN ${report('reportType')} <> ${tools.ozone.report.defs.ReasonAppeal} THEN NULL
    WHEN ${activity('activityType')} <> 'closeActivity' THEN NULL
    WHEN ${activity('meta')} ->> 'appealOutcome' = 'denied' THEN 'denied'
    ELSE (
      SELECT CASE
        WHEN resolution.action = ${tools.ozone.moderation.defs.modEventReverseTakedown.$type}
          OR (resolution.action = ${tools.ozone.moderation.defs.modEventLabel.$type}
            AND nullif(btrim(resolution."negateLabelVals"), '') IS NOT NULL)
        THEN 'approved' ELSE 'denied' END
      FROM moderation_event AS resolution
      WHERE resolution.id = CASE
        WHEN (${activity('meta')} ->> 'actionEventId') ~ '^[1-9][0-9]{0,9}$'
        THEN (${activity('meta')} ->> 'actionEventId')::bigint END
        AND resolution.id > ${report('eventId')}
        AND ${report('actionEventIds')} @> jsonb_build_array(resolution.id)
        AND resolution."subjectDid" = ${report('did')}
        AND (
          (${report('recordPath')} = ''
            AND resolution."subjectType" = ${com.atproto.admin.defs.repoRef.$type})
          OR (${report('recordPath')} <> ''
            AND resolution."subjectType" = ${com.atproto.repo.strongRef.$type}
            AND resolution."subjectUri" = 'at://' || ${report('did')} || '/' || ${report('recordPath')})
        )
    ) END`
}

/** Read the current closure without confusing it with an earlier resolution. */
export function appealOutcomeSelection(): AliasedRawBuilder<
  AppealOutcome | null,
  'outcome'
> {
  return sql<AppealOutcome | null>`(
    SELECT ${appealActivityOutcome('report', 'closure')}
    FROM report_activity AS closure
    WHERE ${sql.ref('report.status')} = 'closed'
      AND closure."reportId" = ${sql.ref('report.id')}
      AND closure."activityType" = 'closeActivity'
      AND closure."createdAt" = ${sql.ref('report.closedAt')}
    ORDER BY closure."createdAt" DESC, closure.id DESC
    LIMIT 1
  )`.as('outcome')
}
