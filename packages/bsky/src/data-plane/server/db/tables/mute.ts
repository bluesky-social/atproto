export interface Mute {
  subjectDid: string
  mutedByDid: string
  createdAt: string
  kinds: string // comma-separated MuteKind names; empty means a full mute
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
