import { Kysely } from 'kysely'
import * as accountEventsStats from './account_events_stats'
import * as accountRecordEventsStats from './account_record_events_stats'
import * as accountRecordStatusStats from './account_record_status_stats'
import * as blobPushEvent from './blob_push_event'
import * as communicationTemplate from './communication_template'
import * as firehoseCursor from './firehose_cursor'
import * as label from './label'
import * as member from './member'
import * as modEvent from './moderation_event'
import * as modSubjectStatus from './moderation_subject_status'
import * as set from './ozone_set'
import * as recordEventsStats from './record_events_stats'
import * as recordPushEvent from './record_push_event'
import * as repoPushEvent from './repo_push_event'
import * as safelink from './safelink'
import * as setting from './setting'
import * as signingKey from './signing_key'
import * as verification from './verification'

export type DatabaseSchemaType = modEvent.PartialDB &
  modSubjectStatus.PartialDB &
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
  verification.PartialDB &
  firehoseCursor.PartialDB &
  safelink.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
