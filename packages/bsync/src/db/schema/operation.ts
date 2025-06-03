import { GeneratedAlways } from 'kysely'
import { Method } from '../../proto/bsync_pb'

export type OperationMethod = Method.CREATE | Method.UPDATE | Method.DELETE

export interface Operation {
  id: GeneratedAlways<number>
  collection: string
  actorDid: string
  rkey: string
  method: OperationMethod
  payload: Uint8Array
  createdAt: GeneratedAlways<Date>
}

export const tableName = 'operation'

export type PartialDB = { [tableName]: Operation }

export const createOperationChannel = 'operation_create' // used with listen/notify
