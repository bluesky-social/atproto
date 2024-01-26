import { Kysely } from 'kysely'
import * as muteOp from './mute_op'
import * as muteItem from './mute_item'

export type DatabaseSchemaType = muteItem.PartialDB & muteOp.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
