export type RecordKey = 'any' | 'nsid' | 'tid' | `literal:${string}`

export function isRecordKey<T>(key: T): key is T & RecordKey {
  return (
    key === 'any' ||
    key === 'nsid' ||
    key === 'tid' ||
    (typeof key === 'string' && key.startsWith('literal:'))
  )
}

export function asRecordKey(key: unknown): RecordKey {
  if (isRecordKey(key)) return key
  throw new Error(`Invalid record key: ${String(key)}`)
}
