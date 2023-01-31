import { Generated } from 'kysely'

export interface SequencedEvent {
  seq: Generated<number>
  did: string
  commit: string
}

export const tableName = 'sequenced_event'

export type PartialDB = { [tableName]: SequencedEvent }
