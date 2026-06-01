import { Kysely } from 'kysely'
import * as muteItem from './mute_item.js'
import * as muteOp from './mute_op.js'
import * as notifItem from './notif_item.js'
import * as notifOp from './notif_op.js'
import * as op from './operation.js'

export type DatabaseSchemaType = muteItem.PartialDB &
  muteOp.PartialDB &
  notifItem.PartialDB &
  notifOp.PartialDB &
  op.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>

export default DatabaseSchema
