export interface Space {
  uri: string
  isOwner: number // 0 or 1, sqlite boolean
  setHash: Uint8Array | null
  rev: string | null
  createdAt: string
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
