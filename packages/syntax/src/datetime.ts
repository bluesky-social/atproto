/* Validates datetime string against atproto Lexicon 'datetime' format.
 * Syntax is described at: https://atproto.com/specs/lexicon#datetime
 */
export const ensureValidDatetime = (dtStr: string): void => {
  const date = new Date(dtStr)
  // must parse as ISO 8601; this also verifies semantics like month is not 13 or 00
  if (isNaN(date.getTime())) {
    throw new InvalidDatetimeError('datetime did not parse as ISO 8601')
  }
  if (date.toISOString().startsWith('-')) {
    throw new InvalidDatetimeError('datetime normalized to a negative time')
  }
  // regex and other checks for RFC-3339
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
  if (dtStr.startsWith('000')) {
    throw new InvalidDatetimeError('datetime so close to year zero not allowed')
  }
}

/* Same logic as ensureValidDatetime(), but returns a boolean instead of throwing an exception.
 */
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

/* Takes a flexible datetime string and normalizes representation.
 *
 * This function will work with any valid atproto datetime (eg, anything which isValidDatetime() is true for). It *additionally* is more flexible about accepting datetimes that don't comply to RFC 3339, or are missing timezone information, and normalizing them to a valid datetime.
 *
 * One use-case is a consistent, sortable string. Another is to work with older invalid createdAt datetimes.
 *
 * Successful output will be a valid atproto datetime with millisecond precision (3 sub-second digits) and UTC timezone with trailing 'Z' syntax. Throws `InvalidDatetimeError` if the input string could not be parsed as a datetime, even with permissive parsing.
 *
 * Expected output format: YYYY-MM-DDTHH:mm:ss.sssZ
 */
export const normalizeDatetime = (dtStr: string): string => {
  if (isValidDatetime(dtStr)) {
    const outStr = new Date(dtStr).toISOString()
    if (isValidDatetime(outStr)) {
      return outStr
    }
  }

  // check if this permissive datetime is missing a timezone
  if (!/.*(([+-]\d\d:?\d\d)|[a-zA-Z])$/.test(dtStr)) {
    const date = new Date(dtStr + 'Z')
    if (!isNaN(date.getTime())) {
      const tzStr = date.toISOString()
      if (isValidDatetime(tzStr)) {
        return tzStr
      }
    }
  }

  // finally try parsing as simple datetime
  const date = new Date(dtStr)
  if (isNaN(date.getTime())) {
    throw new InvalidDatetimeError(
      'datetime did not parse as any timestamp format',
    )
  }
  const isoStr = date.toISOString()
  if (isValidDatetime(isoStr)) {
    return isoStr
  } else {
    throw new InvalidDatetimeError(
      'datetime normalized to invalid timestamp string',
    )
  }
}

/* Variant of normalizeDatetime() which always returns a valid datetime strings.
 *
 * If a InvalidDatetimeError is encountered, returns the UNIX epoch time as a UTC datetime (1970-01-01T00:00:00.000Z).
 */
export const normalizeDatetimeAlways = (dtStr: string): string => {
  try {
    return normalizeDatetime(dtStr)
  } catch (err) {
    if (err instanceof InvalidDatetimeError) {
      return new Date(0).toISOString()
    }
    throw err
  }
}

/* Indicates a datetime string did not pass full atproto Lexicon datetime string format checks.
 */
export class InvalidDatetimeError extends Error {}
