export type RecordKeyDefinition = 'any' | 'nsid' | 'tid' | `literal:${string}`

export function isRecordKeyDefinition<T>(
  key: T,
): key is T & RecordKeyDefinition {
  return (
    key === 'any' ||
    key === 'nsid' ||
    key === 'tid' ||
    (typeof key === 'string' && key.startsWith('literal:'))
  )
}

export function asRecordKeyDefinition(key: unknown): RecordKeyDefinition {
  if (isRecordKeyDefinition(key)) return key
  throw new Error(`Invalid record key: ${String(key)}`)
}
