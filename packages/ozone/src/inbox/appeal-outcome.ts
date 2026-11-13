import { type RawBuilder, type SqlBool, sql } from 'kysely'
import { com, tools } from '../lexicons/index.js'

export type AppealOutcome = 'approved' | 'denied'

export const appealReportSelection = [
  'id',
  'did',
  'recordPath',
  'reportType',
  'status',
  'createdAt',
  'updatedAt',
  'closedAt',
  'eventId',
  'actionEventIds',
] as const

/** Match only the closing activity's linked resolution on the same subject. */
export function appealResolutionFilter(
  reportAlias: 'report' | 'r',
  activityAlias: 'closure' | 'activity',
): RawBuilder<SqlBool> {
  const report = (column: string) => sql.ref(`${reportAlias}.${column}`)
  const activity = (column: string) => sql.ref(`${activityAlias}.${column}`)
  return sql<SqlBool>`
    ${report('reportType')} = ${tools.ozone.report.defs.ReasonAppeal}
    AND ${activity('activityType')} = 'closeActivity'
    AND ${activity('meta')} ->> 'appealOutcome' IS DISTINCT FROM 'denied'
    AND resolution.id = CASE
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
  `
}

/** Derive the decision from a closure and its already joined resolution. */
export function appealActivityOutcome(
  reportAlias: 'report' | 'r',
  activityAlias: 'closure' | 'activity',
): RawBuilder<AppealOutcome | null> {
  const report = (column: string) => sql.ref(`${reportAlias}.${column}`)
  const activity = (column: string) => sql.ref(`${activityAlias}.${column}`)
  return sql<AppealOutcome | null>`CASE
    WHEN ${report('reportType')} <> ${tools.ozone.report.defs.ReasonAppeal}
      OR ${activity('activityType')} <> 'closeActivity'
      OR ${activity('id')} IS NULL THEN NULL
    WHEN ${activity('meta')} ->> 'appealOutcome' = 'denied' THEN 'denied'
    WHEN resolution.id IS NULL THEN NULL
    WHEN resolution.action = ${tools.ozone.moderation.defs.modEventReverseTakedown.$type}
      OR (resolution.action = ${tools.ozone.moderation.defs.modEventLabel.$type}
        AND nullif(btrim(resolution."negateLabelVals"), '') IS NOT NULL)
    THEN 'approved' ELSE 'denied' END`
}
