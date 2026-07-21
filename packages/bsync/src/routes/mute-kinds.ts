import { MuteKind } from '../proto/bsync_pb.js'

/**
 * The database encoding of a mute's kinds: a comma-separated string of kind
 * names, sorted and deduped. An empty string means a full mute.
 *
 * bsync does not validate kind values — bsky's muteActor is the validation
 * gate, and consumers ignore values they don't recognize. Kinds bsync knows
 * are stored by name for legibility; unrecognized enum values are stored as
 * their numeric value so they still round-trip to consumers, letting new
 * kinds ship without a bsync deploy.
 */
export type StoredMuteKinds = string

const kindNames = new Map<MuteKind, string>([
  [MuteKind.REPOSTS, 'reposts'],
  [MuteKind.QUOTEPOSTS, 'quoteposts'],
])

const kindsByName = new Map<string, MuteKind>(
  [...kindNames].map(([kind, name]) => [name, kind]),
)

export const muteKindsToStored = (kinds: MuteKind[]): StoredMuteKinds => {
  const names = kinds.map((kind) => kindNames.get(kind) ?? String(kind))
  return [...new Set(names)].sort().join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): MuteKind[] => {
  if (kinds === '') return []
  return kinds
    .split(',')
    .map((name) => kindsByName.get(name) ?? (Number(name) as MuteKind))
    .sort((a, b) => a - b)
}
