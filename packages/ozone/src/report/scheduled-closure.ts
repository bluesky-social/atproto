import { type RawBuilder, type SqlBool, sql } from 'kysely'

/** Match server-owned schedule provenance on a report's current closure. */
export function scheduledClosureFilter(): RawBuilder<SqlBool> {
  return sql<SqlBool>`scheduled.id = CASE
    WHEN closure.meta ->> 'scheduledActionId' ~ '^[1-9][0-9]{0,9}$'
    THEN (closure.meta ->> 'scheduledActionId')::bigint END
    AND scheduled.did = r.did
    AND scheduled."eventData" ->> 'reportEventId' = closure.meta ->> 'actionEventId'`
}

/** A report closure stays pending for its reporter until enforcement succeeds. */
export function unexecutedScheduledClosure(): RawBuilder<SqlBool> {
  return sql<SqlBool>`exists (
    select 1 from (
      select meta from report_activity
      where "reportId" = r.id and "activityType" = 'closeActivity'
      order by "createdAt" desc, id desc
      limit 1
    ) closure
    join scheduled_action scheduled on ${scheduledClosureFilter()}
    where scheduled.status <> 'executed' or scheduled."executionEventId" is null
  )`
}
