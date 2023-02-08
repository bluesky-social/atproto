export interface Hide {
  uri: string
  hiddenByDid: string
  createdAt: string
}

export const tableName = 'hide'

export type PartialDB = { [tableName]: Hide }
