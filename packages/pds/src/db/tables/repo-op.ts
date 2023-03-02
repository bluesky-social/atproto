import { WriteOpAction } from '@atproto/repo'

export interface RepoOp {
  did: string
  commit: string
  action: WriteOpAction
  path: string
  cid: string | null
}

export const tableName = 'repo_op'

export type PartialDB = { [tableName]: RepoOp }
