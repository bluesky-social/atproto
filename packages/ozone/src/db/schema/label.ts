import { Generated } from 'kysely'

export const tableName = 'label'

export interface Label {
  id: Generated<number>
  src: string
  uri: string
  cid: string
  val: string
  neg: boolean
  cts: string
}

export type PartialDB = { [tableName]: Label }
