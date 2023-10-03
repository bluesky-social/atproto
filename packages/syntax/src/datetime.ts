export const ensureValidDatetime = (dtStr: string): void => {
  /*
  if (!isValidISODateString(dtStr)) {
    throw new InvalidDatetimeError('datetime did not parse as ISO 8601')
  }
  */
  const date = new Date(dtStr)
  if (isNaN(date.getTime())) {
    throw new InvalidDatetimeError('datetime did not parse as ISO 8601')
  }
  if (
    !/^[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-6][0-9]:[0-6][0-9](.[0-9]{1,20})?(Z|([+-][0-2][0-9]:[0-5][0-9]))$/.test(
      dtStr,
    )
  ) {
    throw new InvalidDatetimeError("datetime didn't validate via regex")
  }
  if (dtStr.length > 64) {
    throw new InvalidDatetimeError('datetime is too long (64 chars max)')
  }
  if (dtStr.endsWith('-00:00')) {
    throw new InvalidDatetimeError(
      'datetime can not use "-00:00" for UTC timezone',
    )
  }
}

// Normalize date strings to simplified ISO so that the lexical sort preserves temporal sort.
// Rather than failing on an invalid date format, returns valid unix epoch.
export const normalizeDatetime = (dtStr: string): string => {
  const date = new Date(dtStr)
  if (isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }
  const iso = date.toISOString()
  if (!isValidDatetime(iso)) {
    // Occurs in rare cases, e.g. where resulting UTC year is negative. These also don't preserve lexical sort.
    return new Date(0).toISOString()
  }
  return iso // YYYY-MM-DDTHH:mm:ss.sssZ
}

export const isValidDatetime = (dtStr: string): boolean => {
  try {
    ensureValidDatetime(dtStr)
  } catch (err) {
    if (err instanceof InvalidDatetimeError) {
      return false
    }
    throw err
  }

  return true
}

export class InvalidDatetimeError extends Error {}
