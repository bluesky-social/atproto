import type { StoredMuteKinds } from '../../../util/mute-kinds.js'

export interface Mute {
  subjectDid: string
  mutedByDid: string
  createdAt: string
  kinds: StoredMuteKinds
}

export const tableName = 'mute'

export type PartialDB = { [tableName]: Mute }
