export interface RuntimeFlag {
  name: string
  value: string
}

export const tableName = 'runtime_flag'

export type PartialDB = { [tableName]: RuntimeFlag }
