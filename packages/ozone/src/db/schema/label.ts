import { GeneratedAlways } from 'kysely'

export const tableName = 'label'

export interface Label {
  id: GeneratedAlways<number>
  src: string
  uri: string
  cid: string
  val: string
  neg: boolean
  cts: string
}

export type PartialDB = { [tableName]: Label }
