// Normalize date strings to simplified ISO so that the lexical sort preserves temporal sort.
// Rather than failing on an invalid date format, returns valid unix epoch.
export function toSimplifiedISOSafe(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }
  return date.toISOString() // YYYY-MM-DDTHH:mm:ss.sssZ
}
