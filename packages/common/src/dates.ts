// Normalize date strings to simplified ISO so that the lexical sort preserves temporal sort.
// Rather than failing on an invalid date format, returns valid unix epoch.
export function toSimplifiedISOSafe(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }
  const iso = date.toISOString()

  // Date.toISOString() always returns `YYYY-MM-DDTHH:mm:ss.sssZ` or
  // `±YYYYYY-MM-DDTHH:mm:ss.sssZ`
  // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
  // However, the leading `±` and 6 digit year can break lexical sorting, so we
  // need to catch those cases and return a safe value.
  if (iso.startsWith('-') || iso.startsWith('+')) {
    return new Date(0).toISOString()
  }

  return iso // YYYY-MM-DDTHH:mm:ss.sssZ
}
