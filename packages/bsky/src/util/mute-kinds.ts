import { MuteKind } from '../proto/bsky_pb.js'

// Mute kinds are stored as a comma-separated string of kind names, sorted
// and deduped. An empty string means a full mute. The bsync proto's MuteKind
// uses the same values as the bsky proto's, so these helpers accept either.

const kindNames = new Map<number, string>([
  [MuteKind.REPOSTS, 'reposts'],
  [MuteKind.QUOTEPOSTS, 'quoteposts'],
])

const kindsByName = new Map<string, MuteKind>(
  [...kindNames].map(([kind, name]) => [name, kind]),
)

export const muteKindsToString = (kinds: number[]): string => {
  const names = kinds
    .map((kind) => kindNames.get(kind))
    .filter((name) => name !== undefined)
  return [...new Set(names)].sort().join(',')
}

export const muteKindsFromString = (kinds: string): MuteKind[] => {
  if (kinds === '') return []
  return kinds
    .split(',')
    .map((name) => kindsByName.get(name))
    .filter((kind) => kind !== undefined)
    .sort((a, b) => a - b)
}

export const stringHasMuteKind = (kinds: string, kind: number): boolean => {
  const name = kindNames.get(kind)
  if (name === undefined) return false
  return kinds.split(',').includes(name)
}
