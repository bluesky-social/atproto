const MAX_CURSOR_LEN = 2048

export const clearlyBadCursor = (cursor?: string) => {
  if (!cursor) return false
  if (cursor.length > MAX_CURSOR_LEN) return true
  // Legacy bsky mixed-format cursors; Sokaa uses `primary__secondary`.
  if (cursor.includes('::')) return true
  const parts = cursor.split('__')
  return parts.length !== 2 || !parts[0] || !parts[1]
}

export const resHeaders = (): Record<string, string> => {
  return {}
}
