export interface Mute {
  subjectDid: string
  mutedByDid: string
  createdAt: string
  kind: 'all' | 'reposts'
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
