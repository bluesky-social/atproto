export const tableName = 'label'

export interface Label {
  src: string
  uri: string
  cid: string
  val: string
  neg: 0 | 1 // @TODO convert to boolean in app-view
  cts: string
}

export type PartialDB = { [tableName]: Label }
