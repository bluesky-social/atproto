/**
 * The database encoding of a mute's kinds: a comma-separated string of kind
 * names (e.g. "quoteposts,reposts"), sorted and deduped. An empty string
 * means a full mute.
 *
 * Kind values are not validated here — bsky's muteActor is the validation
 * gate. Readers check for specific known kinds and naturally ignore values
 * they don't recognize, so kinds from a newer producer pass through
 * harmlessly.
 */
export type StoredMuteKinds = string

export const muteKindsToStored = (kinds: string[]): StoredMuteKinds => {
  return [...new Set(kinds)].sort().join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): string[] => {
  if (kinds === '') return []
  return kinds.split(',')
}

export const storedHasMuteKind = (
  kinds: StoredMuteKinds,
  kind: string,
): boolean => {
  return kinds.split(',').includes(kind)
}
