export interface PreorderMap {
  lpath: string
  depth: number
  cid: string
}

export const tableName = 'preorder_map'

export type PartialDB = { [tableName]: PreorderMap }
