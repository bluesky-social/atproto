export type LexRecordKey = 'any' | 'nsid' | 'tid' | `literal:${string}`

export function isLexRecordKey(key: unknown): key is LexRecordKey {
  return (
    key === 'any' ||
    key === 'nsid' ||
    key === 'tid' ||
    (typeof key === 'string' && key.startsWith('literal:'))
  )
}

export function asLexRecordKey(key: unknown): LexRecordKey {
  if (isLexRecordKey(key)) return key
  throw new Error(`Invalid record key: ${String(key)}`)
}
