export interface Mute {
  subjectDid: string
  mutedByDid: string
  createdAt: string
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
