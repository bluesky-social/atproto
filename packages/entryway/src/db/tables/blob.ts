export interface Blob {
  creator: string
  cid: string
  mimeType: string
  size: number
  tempKey: string | null
  width: number | null
  height: number | null
  createdAt: string
}

export const tableName = 'blob'

export type PartialDB = { [tableName]: Blob }
