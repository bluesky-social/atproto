export interface Space {
  uri: string
  // Both denormalized out of the uri, so spaces can be filtered without matching on it.
  authority: string
  type: string
  createdAt: string
  deletedAt: string | null
}

const tableName = 'space'

export type PartialDB = { [tableName]: Space }
