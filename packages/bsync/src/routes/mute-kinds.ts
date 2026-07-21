import { Code, ConnectError } from '@connectrpc/connect'
import { MuteKind } from '../proto/bsync_pb.js'

/**
 * The database encoding of a mute's kinds: a comma-separated string of kind
 * names, sorted and deduped. An empty string means a full mute.
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
  const names = kinds.map((kind) => {
    const name = kindNames.get(kind)
    if (name === undefined) {
      throw new ConnectError('bad mute kind', Code.InvalidArgument)
    }
    return name
  })
  return [...new Set(names)].sort().join(',')
}

export const muteKindsFromStored = (kinds: StoredMuteKinds): MuteKind[] => {
  if (kinds === '') return []
  return kinds
    .split(',')
    .map((name) => {
      const kind = kindsByName.get(name)
      if (kind === undefined) {
        throw new Error(`unknown mute kind: ${name}`)
      }
      return kind
    })
    .sort((a, b) => a - b)
}
