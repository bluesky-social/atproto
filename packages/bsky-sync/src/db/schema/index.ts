import { Kysely } from 'kysely'
import * as muteOp from './mute-op'
import * as muteItem from './mute-item'

export type DatabaseSchemaType = muteItem.PartialDB & muteOp.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
