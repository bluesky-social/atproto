export interface Hide {
  cid: string
  hiddenByDid: string
  createdAt: string // seen at
}

export const tableName = 'hide'

export type PartialDB = { [tableName]: Hide }
