export const tableName = 'label'

export interface Label {
  src: string
  uri: string
  cid: string
  val: string
  neg: boolean
  cts: string
}

export type PartialDB = { [tableName]: Label }
