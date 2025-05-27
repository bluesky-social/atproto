import { GeneratedAlways } from 'kysely'
import { Method } from '../../proto/bsync_pb'

export type OpMethod = Method.CREATE | Method.UPDATE | Method.DELETE

export interface Op {
  id: GeneratedAlways<number>
  collection: string
  actorDid: string
  rkey: string
  method: OpMethod
  payload: Uint8Array
  createdAt: GeneratedAlways<Date>
}

export const tableName = 'op'

export type PartialDB = { [tableName]: Op }

export const createOpChannel = 'op_create' // used with listen/notify
