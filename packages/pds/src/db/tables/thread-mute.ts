export interface ThreadMute {
  did: string
  threadRoot: string
}

export const tableName = 'thread_mute'

export type PartialDB = { [tableName]: ThreadMute }
