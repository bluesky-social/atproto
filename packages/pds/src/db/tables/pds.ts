import { GeneratedAlways } from 'kysely'

export interface Pds {
  id: GeneratedAlways<number>
  did: string
  host: string
}

export const tableName = 'pds'

export type PartialDB = { [tableName]: Pds }
