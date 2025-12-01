import { isValidRecordKey } from '@atproto/syntax'

export type LexiconRecordKey = 'any' | 'nsid' | 'tid' | `literal:${string}`

/*@__NO_SIDE_EFFECTS__*/
export function isLexiconRecordKey<T>(key: T): key is T & LexiconRecordKey {
  return (
    key === 'any' ||
    key === 'nsid' ||
    key === 'tid' ||
    (typeof key === 'string' &&
      key.startsWith('literal:') &&
      key.length > 8 &&
      isValidRecordKey(key.slice(8)))
  )
}

/*@__NO_SIDE_EFFECTS__*/
export function asLexiconRecordKey(key: unknown): LexiconRecordKey {
  if (isLexiconRecordKey(key)) return key
  throw new Error(`Invalid record key: ${String(key)}`)
}
