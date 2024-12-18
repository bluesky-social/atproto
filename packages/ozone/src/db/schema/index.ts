import { Kysely } from 'kysely'

import * as blobPushEvent from './blob_push_event'
import * as communicationTemplate from './communication_template'
import * as label from './label'
import * as member from './member'
import * as modEvent from './moderation_event'
import * as modSubjectStatus from './moderation_subject_status'
import * as set from './ozone_set'
import * as recordPushEvent from './record_push_event'
import * as repoPushEvent from './repo_push_event'
import * as setting from './setting'
import * as signingKey from './signing_key'

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
  setting.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
