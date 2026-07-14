import type { Kysely } from 'kysely'
import type * as muteItem from './mute_item.js'
import type * as muteOp from './mute_op.js'
import type * as notifItem from './notif_item.js'
import type * as notifOp from './notif_op.js'
import type * as op from './operation.js'

export type DatabaseSchemaType = muteItem.PartialDB &
  muteOp.PartialDB &
  notifItem.PartialDB &
  notifOp.PartialDB &
  op.PartialDB

export type DatabaseSchema = Kysely<DatabaseSchemaType>
