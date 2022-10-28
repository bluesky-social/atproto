export interface IpldBlockCreator {
  cid: string
  did: string
}

export const tableName = 'ipld_block_creator'

export type PartialDB = { [tableName]: IpldBlockCreator }
