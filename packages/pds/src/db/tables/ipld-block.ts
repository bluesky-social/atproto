export interface IpldBlock {
  cid: string
  creator: string
  repoRev: string | null
  size: number
  content: Uint8Array
}

export const tableName = 'ipld_block'

export type PartialDB = { [tableName]: IpldBlock }
