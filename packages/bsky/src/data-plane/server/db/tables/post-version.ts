export const tableName = 'post_version'

export interface PostVersion {
  uri: string
  cid: string
  json: string
  editedAt: string | null
}

export type PartialDB = {
  [tableName]: PostVersion
}
