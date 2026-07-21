import { MuteKind } from '../../proto/bsky_pb.js'

/**
 * The database encoding of a mute's kinds: a comma-separated string of kind
 * names, sorted and deduped. An empty string means a full mute.
 *
 * The bsync proto's MuteKind uses the same values as the bsky proto's, so
 * these helpers accept either enum.
 */
export type StoredMuteKinds = string

const kindNames = new Map<number, string>([
  [MuteKind.REPOSTS, 'reposts'],
  [MuteKind.QUOTEPOSTS, 'quoteposts'],
])

const kindsByName = new Map<string, MuteKind>(
  [...kindNames].map(([kind, name]) => [name, kind]),
)

export const muteKindsToStored = (kinds: number[]): StoredMuteKinds => {
  const names = kinds
    .map((kind) => kindNames.get(kind))
    .filter((name) => name !== undefined)
  return [...new Set(names)].sort().join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): MuteKind[] => {
  if (kinds === '') return []
  return kinds
    .split(',')
    .map((name) => kindsByName.get(name))
    .filter((kind) => kind !== undefined)
    .sort((a, b) => a - b)
}

export const storedHasMuteKind = (
  kinds: StoredMuteKinds,
  kind: number,
): boolean => {
  const name = kindNames.get(kind)
  if (name === undefined) return false
  return kinds.split(',').includes(name)
}
