export interface Backlink {
  uri: string
  path: string
  linkToUri: string | null
  linkToDid: string | null
}

export const tableName = 'backlink'

export type PartialDB = { [tableName]: Backlink }
