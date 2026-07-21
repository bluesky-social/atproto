/**
 * The database encoding of a mute's kinds: a comma-separated string of kind
 * names (e.g. "quoteposts,reposts"), sorted and deduped. An empty string
 * means a full mute.
 *
 * bsync does not validate kind values — it stores and replays whatever the
 * producer sent. Validation happens upstream (bsky's muteActor); consumers
 * are expected to ignore values they don't recognize. This lets new kinds
 * ship without a bsync deploy.
 */
export type StoredMuteKinds = string

export const muteKindsToStored = (kinds: string[]): StoredMuteKinds => {
  return [...new Set(kinds)].sort().join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): string[] => {
  if (kinds === '') return []
  return kinds.split(',')
}
