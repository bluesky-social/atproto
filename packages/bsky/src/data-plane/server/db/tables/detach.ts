const tableName = 'detach'

export interface Detach {
  uri: string
  post: string
  targets: string[]
  updatedAt: string
}

export type PartialDB = { [tableName]: Detach }
