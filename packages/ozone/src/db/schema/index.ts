import type { Kysely } from 'kysely'
import type * as accountEventsStats from './account_events_stats.js'
import type * as accountRecordEventsStats from './account_record_events_stats.js'
import type * as accountRecordStatusStats from './account_record_status_stats.js'
import type * as accountStrike from './account_strike.js'
import type * as blobPushEvent from './blob_push_event.js'
import type * as communicationTemplate from './communication_template.js'
import type * as expiringTag from './expiring_tag.js'
import type * as firehoseCursor from './firehose_cursor.js'
import type * as jobCursor from './job_cursor.js'
import type * as label from './label.js'
import type * as member from './member.js'
import type * as modEvent from './moderation_event.js'
import type * as modSubjectStatus from './moderation_subject_status.js'
import type * as moderatorAssignment from './moderator_assignment.js'
import type * as set from './ozone_set.js'
import type * as recordEventsStats from './record_events_stats.js'
import type * as recordPushEvent from './record_push_event.js'
import type * as repoPushEvent from './repo_push_event.js'
import type * as report from './report.js'
import type * as reportActivity from './report_activity.js'
import type * as reportQueue from './report_queue.js'
import type * as reportStat from './report_stat.js'
import type * as safelink from './safelink.js'
import type * as scheduledAction from './scheduled-action.js'
import type * as setting from './setting.js'
import type * as signingKey from './signing_key.js'
import type * as verification from './verification.js'

export type DatabaseSchemaType = modEvent.PartialDB &
  modSubjectStatus.PartialDB &
  report.PartialDB &
  reportActivity.PartialDB &
  reportQueue.PartialDB &
  label.PartialDB &
  signingKey.PartialDB &
  repoPushEvent.PartialDB &
  recordPushEvent.PartialDB &
  blobPushEvent.PartialDB &
  communicationTemplate.PartialDB &
  set.PartialDB &
  member.PartialDB &
  setting.PartialDB &
  accountEventsStats.PartialDB &
  recordEventsStats.PartialDB &
  accountRecordEventsStats.PartialDB &
  accountRecordStatusStats.PartialDB &
  accountStrike.PartialDB &
  verification.PartialDB &
  firehoseCursor.PartialDB &
  jobCursor.PartialDB &
  safelink.PartialDB &
  scheduledAction.PartialDB &
  moderatorAssignment.PartialDB &
  reportStat.PartialDB &
  expiringTag.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>
