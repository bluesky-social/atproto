/**
 * A strictly formatted UTC datetime string (`YYYY-MM-DDTHH:mm:ss.sssZ` or `±YYYYYY-MM-DDTHH:mm:ss.sssZ`) as returned by {@link Date.toISOString}.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString}
 */
export type StandardDatetimeString =
  `${string}-${string}-${string}T${string}:${string}:${string}Z`

export type OffsetDatetimeString =
  `${string}-${string}-${string}T${string}:${string}:${string}${'+' | '-'}${string}:${string}`

/**
 * An {@link https://www.rfc-editor.org/rfc/rfc3339 RFC-3339} and {@link https://www.iso.org/iso-8601-date-and-time-format.html ISO 8601} compliant datetime string
 */
export type DatetimeString = StandardDatetimeString | OffsetDatetimeString

// Allow date.toISOString() to be used where datetime format is expected
declare global {
  interface Date {
    toISOString(): StandardDatetimeString
  }
}

const DATETIME_REGEX =
  /^[0-9]{4}-(?:0[1-9]|1[012])-(?:[0-2][0-9]|3[01])T(?:[0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{1,20})?(?:Z|([+-][0-2][0-9]:[0-5][0-9]))$/

/**
 * Validates datetime string against atproto Lexicon 'datetime' format.
 *
 * @see {@link https://atproto.com/specs/lexicon#datetime}
 */
export function ensureValidDatetime<I>(
  input: I,
): asserts input is I & DatetimeString {
  const result = parseDatetime(input)
  if (!result.success) {
    throw new InvalidDatetimeError(result.message)
  }
}

type FailureResult = { success: false; message: string }
const failure = (m: string): FailureResult => ({ success: false, message: m })
type SuccessResult<V> = { success: true; value: V }
const success = <V>(v: V): SuccessResult<V> => ({ success: true, value: v })
type Result<V> = FailureResult | SuccessResult<V>

/**
 * Validates that the input is a valid datetime string according to atproto
 * Lexicon rules, and parses it into a Date object.
 */
function parseDatetime(input: unknown): Result<Date> {
  // @NOTE Performing cheap tests first
  if (typeof input !== 'string') {
    return failure('datetime must be a string')
  }
  if (input.length > 64) {
    return failure('datetime is too long (64 chars max)')
  }
  if (input.endsWith('-00:00')) {
    return failure('datetime can not use "-00:00" for UTC timezone')
  }
  if (!DATETIME_REGEX.test(input)) {
    return failure("datetime didn't validate via regex")
  }

  // must parse as ISO 8601; this also verifies semantics like month is not 13 or 00
  const date = new Date(input)

  return validateDatetimeDate(date)
}

/**
 * Ensures that a Date object represents a valid datetime according to atproto
 * Lexicon rules. This ensures that `date.toISOString()` will produce a valid
 * datetime string that can be used where {@link DatetimeString} is expected.
 */
function validateDatetimeDate(date: Date): Result<Date> {
  const fullYear = date.getUTCFullYear()
  if (Number.isNaN(fullYear)) {
    return failure('datetime did not parse as ISO 8601')
  }
  // Ensure that the ISO string representation does not start with ±YYYYYY
  if (fullYear < 0) {
    return failure('datetime normalized to a negative time')
  }
  if (fullYear > 9999) {
    return failure('datetime year is too far in the future')
  }
  if (fullYear < 10) {
    return failure('datetime so close to year zero not allowed')
  }
  return success(date)
}

/* Same logic as ensureValidDatetime(), but returns a boolean instead of throwing an exception.
 */
export function isValidDatetime<I>(input: I): input is I & DatetimeString {
  return parseDatetime(input).success
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
export function normalizeDatetime(dtStr: string): DatetimeString {
  const parsed = parseDatetime(dtStr)
  if (parsed.success) {
    return parsed.value.toISOString()
  }

  // check if this permissive datetime is missing a timezone
  if (!/.*(([+-]\d\d:?\d\d)|[a-zA-Z])$/.test(dtStr)) {
    const date = new Date(dtStr + 'Z')
    const valid = validateDatetimeDate(date)
    if (valid.success) {
      return date.toISOString()
    }
  }

  // finally try parsing as simple datetime
  const date = new Date(dtStr)
  const validated = validateDatetimeDate(date)
  if (validated.success) {
    return validated.value.toISOString()
  }

  throw new InvalidDatetimeError(
    'datetime did not parse as any timestamp format',
  )
}

/* Variant of normalizeDatetime() which always returns a valid datetime strings.
 *
 * If a InvalidDatetimeError is encountered, returns the UNIX epoch time as a UTC datetime (1970-01-01T00:00:00.000Z).
 */
export const normalizeDatetimeAlways = (dtStr: string): DatetimeString => {
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
