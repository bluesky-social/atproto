export interface Mute {
  subjectDid: string
  mutedByDid: string
  createdAt: string
  // scope restrictions: when any is set, just the scoped content is muted;
  // when none are set, the subject is fully muted
  onlyReposts: boolean
  onlyQuoteposts: boolean
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
