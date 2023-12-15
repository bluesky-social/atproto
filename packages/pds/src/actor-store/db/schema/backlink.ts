export interface Backlink {
  uri: string
  path: string
  linkTo: string
}

export const tableName = 'backlink'

export type PartialDB = { [tableName]: Backlink }
