export const snapshotTableName = 'snapshot'

export interface Snapshot {
  did: string
  uri: string | null
  cid: string | null
  record: string
  createdAt: Date
}

export type PartialDB = {
  [snapshotTableName]: Snapshot
}
