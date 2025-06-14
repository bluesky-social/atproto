import { GeneratedAlways } from 'kysely'
import { Method } from '../../proto/bsync_pb'

export type OperationMethod = Method.CREATE | Method.UPDATE | Method.DELETE

export interface Operation {
  id: GeneratedAlways<number>
  actorDid: string
  namespace: string
  key: string
  method: OperationMethod
  payload: Uint8Array
  createdAt: GeneratedAlways<Date>
}

export const tableName = 'operation'

export type PartialDB = { [tableName]: Operation }

export const createOperationChannel = 'operation_create' // used with listen/notify
