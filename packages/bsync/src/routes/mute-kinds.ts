import type { MuteKind } from '../proto/bsync_pb.js'

/**
 * The database encoding of a mute's kinds: a comma-separated string of
 * MuteKind enum values, sorted and deduped. An empty string means a full
 * mute.
 *
 * bsync does not validate kind values — it stores and replays whatever the
 * producer sent. Validation happens upstream (bsky's muteActor); consumers
 * are expected to ignore values they don't recognize.
 */
export type StoredMuteKinds = string

export const muteKindsToStored = (kinds: MuteKind[]): StoredMuteKinds => {
  return [...new Set(kinds)].sort((a, b) => a - b).join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): MuteKind[] => {
  if (kinds === '') return []
  return kinds.split(',').map((value) => Number(value) as MuteKind)
}
