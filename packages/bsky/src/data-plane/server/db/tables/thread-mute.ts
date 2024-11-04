export const tableName = 'thread_mute'

export interface ThreadMute {
  rootUri: string
  mutedByDid: string
  createdAt: string
}

export type PartialDB = { [tableName]: ThreadMute }
