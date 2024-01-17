import { Generated, Selectable } from 'kysely'

export const tableName = 'label'

export interface Label {
  id: Generated<number>
  src: string
  uri: string
  cid: string
  val: string
  neg: boolean
  cts: string
  sig: string | null
  signer: string | null
}

export type LabelRow = Selectable<Label>

export type PartialDB = { [tableName]: Label }
