export const tableName = 'list_mute'

export interface ListMute {
  listUri: string
  mutedByDid: string
  createdAt: string
}

export type PartialDB = { [tableName]: ListMute }
