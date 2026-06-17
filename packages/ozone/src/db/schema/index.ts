import { Kysely } from 'kysely'
import * as accountEventsStats from './account_events_stats.js'
import * as accountRecordEventsStats from './account_record_events_stats.js'
import * as accountRecordStatusStats from './account_record_status_stats.js'
import * as accountStrike from './account_strike.js'
import * as blobPushEvent from './blob_push_event.js'
import * as communicationTemplate from './communication_template.js'
import * as expiringTag from './expiring_tag.js'
import * as firehoseCursor from './firehose_cursor.js'
import * as jobCursor from './job_cursor.js'
import * as label from './label.js'
import * as member from './member.js'
import * as modEvent from './moderation_event.js'
import * as modSubjectStatus from './moderation_subject_status.js'
import * as moderatorAssignment from './moderator_assignment.js'
import * as set from './ozone_set.js'
import * as recordEventsStats from './record_events_stats.js'
import * as recordPushEvent from './record_push_event.js'
import * as repoPushEvent from './repo_push_event.js'
import * as report from './report.js'
import * as reportActivity from './report_activity.js'
import * as reportQueue from './report_queue.js'
import * as reportStat from './report_stat.js'
import * as safelink from './safelink.js'
import * as scheduledAction from './scheduled-action.js'
import * as setting from './setting.js'
import * as signingKey from './signing_key.js'
import * as verification from './verification.js'

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

export default DatabaseSchema
