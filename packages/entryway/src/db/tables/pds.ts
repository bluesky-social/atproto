import { Generated, GeneratedAlways } from 'kysely'

export interface Pds {
  id: GeneratedAlways<number>
  did: string
  host: string
  weight: Generated<number>
}

export const tableName = 'pds'

export type PartialDB = { [tableName]: Pds }
