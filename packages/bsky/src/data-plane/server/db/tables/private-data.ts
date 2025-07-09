export interface PrivateData {
  actorDid: string
  namespace: string
  key: string
  // JSON-encoded
  payload: string
  indexedAt: string
  updatedAt: string
}

export const tableName = 'private_data'

export type PartialDB = { [tableName]: PrivateData }
