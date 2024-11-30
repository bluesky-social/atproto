export interface RepoBlock {
  cid: string
  repoRev: string
  size: number
  content: Uint8Array
}

export const tableName = 'repo_block'

export type PartialDB = { [tableName]: RepoBlock }
