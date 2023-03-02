export interface RepoOp {
  did: string
  commit: string
  action: string
  path: string
  cid: string | null
}

export const tableName = 'repo_op'

export type PartialDB = { [tableName]: RepoOp }
