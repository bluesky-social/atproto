import { Kysely } from 'kysely'
import * as modEvent from './moderation_event'
import * as modSubjectStatus from './moderation_subject_status'
import * as pushEvent from './push_event'
import * as label from './label'

export type DatabaseSchemaType = modEvent.PartialDB &
  modSubjectStatus.PartialDB &
  pushEvent.PartialDB &
  label.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
