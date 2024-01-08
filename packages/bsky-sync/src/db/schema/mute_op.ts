import { GeneratedAlways, Selectable } from 'kysely'

export interface MuteOp {
  id: GeneratedAlways<number>
  did: string
  subject: string
  op: 'add' | 'remove' | 'clear'
  createdAt: GeneratedAlways<Date>
}

export type MuteOpEntry = Selectable<MuteOp>

export const tableName = 'mute_op'

export type PartialDB = { [tableName]: MuteOp }
