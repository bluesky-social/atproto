import { Code, ConnectError } from '@connectrpc/connect'
import { MuteKind } from '../proto/bsync_pb.js'

// mute kinds are stored as a comma-separated string of kind names, sorted
// and deduped. an empty string means a full mute.

const kindNames = new Map<MuteKind, string>([
  [MuteKind.REPOSTS, 'reposts'],
  [MuteKind.QUOTEPOSTS, 'quoteposts'],
])

const kindsByName = new Map<string, MuteKind>(
  [...kindNames].map(([kind, name]) => [name, kind]),
)

export const muteKindsToString = (kinds: MuteKind[]): string => {
  const names = kinds.map((kind) => {
    const name = kindNames.get(kind)
    if (name === undefined) {
      throw new ConnectError('bad mute kind', Code.InvalidArgument)
    }
    return name
  })
  return [...new Set(names)].sort().join(',')
}

export const muteKindsFromString = (kinds: string): MuteKind[] => {
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
