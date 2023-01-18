export interface Mute {
  did: string
  mutedByDid: string
  createdAt: string
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
