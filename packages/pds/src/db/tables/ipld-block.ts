export interface IpldBlock {
  cid: string
  size: number
  content: Uint8Array
  indexedAt: string
}

export const tableName = 'ipld_block'

export type PartialDB = { [tableName]: IpldBlock }
