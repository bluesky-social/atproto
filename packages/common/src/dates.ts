// Normalize date strings to simplified ISO so that the lexical sort preserves temporal sort.
// Rather than failing on an invalid date format, returns valid unix epoch.
export function toSimplifiedISOSafe(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }
  const iso = date.toISOString()
  // Date.toISOString() always returns YYYY-MM-DDTHH:mm:ss.sssZ or ±YYYYYY-MM-DDTHH:mm:ss.sssZ
  // developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
  if (iso.startsWith('-') || iso.startsWith('+')) {
    // Occurs in rare cases, e.g. where resulting UTC year is negative. These also don't preserve lexical sort.
    return new Date(0).toISOString()
  }
  return iso // YYYY-MM-DDTHH:mm:ss.sssZ
}
