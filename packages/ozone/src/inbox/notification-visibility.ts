import { sql } from 'kysely'
import type { DatetimeString } from '@atproto/lex'
import { com, tools } from '../lexicons/index.js'
import {
  APPEAL_REASON_TYPE,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
} from './appeal.js'

/** Match notification targets to the same post-cutoff history their detail exposes. */
export function notificationVisibility(startAt: DatetimeString) {
  // @NOTE Guard integer casts for legacy/malformed targets; every source lookup
  // uses a primary key or the subject/creation-time partial index.
  return sql<boolean>`
    n."createdAt" >= ${startAt} AND CASE n.target->>'$type'
      WHEN 'tools.ozone.inbox.defs#reportRef' THEN EXISTS (
        SELECT 1 FROM report r JOIN moderation_event e ON e.id = r."eventId"
        WHERE r.id = CASE WHEN n.target->>'reportId' ~ '^[1-9][0-9]{0,9}$'
          THEN (n.target->>'reportId')::bigint END
          AND r."createdAt" >= ${startAt} AND r."reportType" <> ${APPEAL_REASON_TYPE}
          AND e."createdBy" = n."recipientDid" AND e.action = ${tools.ozone.moderation.defs.modEventReport.$type}
      )
      WHEN 'tools.ozone.inbox.defs#subjectRef' THEN EXISTS (
        SELECT 1 FROM moderation_event e
        WHERE e."subjectDid" = n."recipientDid" AND e."createdAt" >= ${startAt}
          AND e."subjectType" IN (${com.atproto.admin.defs.repoRef.$type}, ${com.atproto.repo.strongRef.$type})
          AND e.action IN (${sql.join(PUBLIC_EVENT_ACTIONS)}) AND e.action <> ${REVERSE_TAKEDOWN}
          AND coalesce(e."subjectUri", e."subjectDid") = coalesce(n.target->'subject'->>'uri', n.target->'subject'->>'did')
      ) AND (n.reason <> 'appealResolved' OR EXISTS (
        SELECT 1 FROM report_activity a JOIN report r ON r.id = a."reportId"
        WHERE a.id = CASE WHEN n."sourceKey" ~ '^report-activity:[1-9][0-9]{0,9}:appealResolved$'
          THEN split_part(n."sourceKey", ':', 2)::bigint END
          AND r."reportType" = ${APPEAL_REASON_TYPE} AND r."createdAt" >= ${startAt}
      ))
      WHEN 'tools.ozone.inbox.defs#standingRef' THEN true
      ELSE false
    END
  `
}
