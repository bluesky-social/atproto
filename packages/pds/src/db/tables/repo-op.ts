export interface RepoOp {
  did: string
  commit: string
  action: string
  collection: string
  rkey: string
}

export const tableName = 'repo_op'

export type PartialDB = { [tableName]: RepoOp }
