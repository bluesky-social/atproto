import { Kysely } from 'kysely'
import * as muteOp from './mute_op'
import * as muteItem from './mute_item'
import * as notifOp from './notif_op'
import * as notifItem from './notif_item'

export type DatabaseSchemaType = muteItem.PartialDB &
  muteOp.PartialDB &
  notifItem.PartialDB &
  notifOp.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
