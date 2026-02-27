/**
 * Indicates a date or string is not a valid representation of a datetime
 * according to the atproto
 * {@link https://atproto.com/specs/lexicon#datetime specification}.
 */
export class InvalidDatetimeError extends Error {}

/**
 * A subset of {@link DatetimeString} that represent valid datetime strings with
 * the format: `YYYY-MM-DDTHH:mm:ss.sssZ`, as returned by `Date.toISOString()
 * for dates between the years 0000 and 9999.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString}
 */
export type ISODatetimeString =
  // @TODO Switch to branded types for more accurate type safety.
  `${string}-${string}-${string}T${string}:${string}:${string}.${string}Z`

/**
 * Represents a {@link Date} that can be safely stringified into a valid atproto
 * datetime string using the {@link Date.toISOString toISOString()} method.
 */
export interface AtprotoDate extends Date {
  toISOString(): ISODatetimeString
}

export function assertAtprotoDate(date: Date): asserts date is AtprotoDate {
  const res = parseDate(date)
  if (!res.success) {
    throw new InvalidDatetimeError(res.message)
  }
}

export function asAtprotoDate(date: Date): AtprotoDate {
  assertAtprotoDate(date)
  return date
}

export function isAtprotoDate(date: Date): date is AtprotoDate {
  return parseDate(date).success
}

declare global {
  // Overload the global Date constructor to allow creating AtprotoDate objects
  // directly from valid datetime strings. This allows for easy creation of
  // DatetimeStrings by doing `new Date().toISOString()`.

  interface DateConstructor {
    new (): AtprotoDate // Only true for a few more years (until year 9999)
    new (value: 0): AtprotoDate
    new (value: ISODatetimeString): AtprotoDate
  }
}

/**
 * A datetime string that meets the requirements of atproto Lexicon 'datetime'
 * format, which is a subset of both
 * {@link https://www.rfc-editor.org/rfc/rfc3339 RFC 3339} and
 * {@link https://www.iso.org/iso-8601-date-and-time-format.html ISO 8601}. This
 * is the expected format for datetime strings in atproto APIs and data
 * structures.
 *
 * @note This literal template type is not accurate enough to ensure that a
 * string is a valid atproto datetime. The {@link assertDatetimeString} function
 * should be used to validate that a string meets the atproto datetime
 * requirements, and the {@link toDatetimeString} function should be used to
 * convert a {@link Date} object into a valid {@link DatetimeString}.
 */
export type DatetimeString =
  // @TODO Switch to branded types for more accurate type safety.
  | `${string}-${string}-${string}T${string}:${string}:${string}Z`
  | `${string}-${string}-${string}T${string}:${string}:${string}${'+' | '-'}${string}:${string}`

declare global {
  // @NOTE **Not** all valid Javascript Date objects can be converted to a valid
  // atproto datetime string. For example, dates with years before 0010 or after
  // 9999, or dates that would normalize to a negative year, are not valid
  // atproto datetimes. The AtprotoDate interface represents Date objects that
  // are guaranteed to be valid atproto datetimes when stringified using
  // toISOString().

  // We *could* overload the global Date interface to always return
  // ISODatetimeString, which would allow assigning any Date.toISOString() to
  // places expecting a DatetimeString without needing to check the date, or use
  // toDatetime(). In practice, this would probably be fine since most real
  // world dates are in the 1xxx-2xxx range. However, it would technically be
  // inaccurate.

  // interface Date {
  //   toISOString(): ISODatetimeString
  // }

  // Instead, we overload the Date constructor to return AtprotoDate, which
  // allows us to use "new Date().toISOString()" and "new Date(0).toISOString()"
  // as valid DatetimeStrings, while still requiring validation for arbitrary
  // date objects.

  interface DateConstructor {
    new (value: DatetimeString): AtprotoDate
  }
}

// Backwards compatibility exports
export {
  assertDatetimeString as ensureValidDatetime,
  isDatetimeString as isValidDatetime,
}

/**
 * Validates datetime string against atproto 'datetime' format.
 *
 * Datetime strings in atproto should meet the
 * {@link https://ijmacd.github.io/rfc3339-iso8601/ intersecting} requirements
 * of the RFC 3339, ISO 8601, and WHATWG HTML datetime standards.
 *
 * @throws InvalidDatetimeError if the input string does not meet the atproto 'datetime' format requirements.
 * @see {@link https://atproto.com/specs/lexicon#datetime}
 */
export function assertDatetimeString<I>(
  input: I,
): asserts input is I & DatetimeString {
  const result = parseString(input)
  if (!result.success) {
    throw new InvalidDatetimeError(result.message)
  }
}

/**
 * Cast a string to a {@link DatetimeString} after validating that it meets the
 * atproto 'datetime' format.
 *
 * @see {@link assertDatetimeString}
 * @throws InvalidDatetimeError if the input string does not meet the atproto 'datetime' format requirements.
 */
export function asDatetimeString(input: string): DatetimeString {
  assertDatetimeString(input)
  return input
}

/**
 * Checks if a string is a valid atproto 'datetime' format string.
 *
 * @see {@link assertDatetimeString}
 */
export function isDatetimeString<I>(input: I): input is I & DatetimeString {
  return parseString(input).success
}

/**
 * Converts any {@link Date} into a {@link DatetimeString} if possible, throwing
 * an error if the date is not a valid atproto datetime.
 *
 * @throws InvalidDatetimeError if the input date is not a valid atproto datetime (eg, it is too far in the future or past, or it normalizes to a negative year).
 */
export function toDatetimeString(date: Date): DatetimeString {
  const res = parseDate(date)
  if (res.success) return res.value.toISOString()
  throw new InvalidDatetimeError(res.message)
}

/**
 * Takes a flexible datetime string and normalizes its representation.
 *
 * This function will work with any valid value that can be parsed as a date. It
 * *additionally* is more flexible about accepting datetimes that are missing
 * timezone information, and normalizing them to a valid atproto datetime.
 *
 * One use-case is a consistent, sortable string. Another is to work with older
 * invalid createdAt datetimes.
 *
 * @returns ISODatetimeString - a valid atproto datetime with millisecond precision (3 sub-second digits) and UTC timezone with trailing 'Z' syntax.
 * @throws InvalidDatetimeError - if the input string could not be parsed as a datetime, even with permissive parsing.
 */
export function normalizeDatetime(dtStr: string): ISODatetimeString {
  // Parse the string as is
  const date = new Date(dtStr)
  if (isAtprotoDate(date)) {
    return date.toISOString()
  }

  // if dtStr is not a valid date, try parsing again with a timezone
  if (isNaN(date.getTime()) && !/.*(([+-]\d\d:?\d\d)|[a-zA-Z])$/.test(dtStr)) {
    const date = new Date(`${dtStr}Z`)
    if (isAtprotoDate(date)) {
      return date.toISOString()
    }
  }

  throw new InvalidDatetimeError(
    'datetime did not parse as any timestamp format',
  )
}

/**
 * Variant of {@link normalizeDatetime} which always returns a valid datetime
 * string.
 *
 * If a {@link InvalidDatetimeError} is encountered, returns the UNIX epoch time
 * as a UTC datetime (`1970-01-01T00:00:00.000Z`).
 *
 * @see {@link normalizeDatetime}
 */
export function normalizeDatetimeAlways(dtStr: string): ISODatetimeString {
  try {
    return normalizeDatetime(dtStr)
  } catch (err) {
    return '1970-01-01T00:00:00.000Z'
  }
}

// -----------------------------------------------------------------------------
// ------------------------- Internal validation logic -------------------------
// -----------------------------------------------------------------------------

// Validation utils that allow avoiding try/catch for control flow (performance
// optimization). Other syntax formats should also use this pattern to avoid
// try/catch in their validation logic, at which point these utils can be moved
// to a common internal utils.
type FailureResult = { success: false; message: string }
const failure = (m: string): FailureResult => ({ success: false, message: m })
type SuccessResult<V> = { success: true; value: V }
const success = <V>(v: V): SuccessResult<V> => ({ success: true, value: v })
type Result<V> = FailureResult | SuccessResult<V>

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc3339#section-5.6 Internet Date/Time Format}
 *
 * @example
 * ```abnf
 * date-fullyear   = 4DIGIT
 * date-month      = 2DIGIT  ; 01-12
 * date-mday       = 2DIGIT  ; 01-28, 01-29, 01-30, 01-31 based on
 *                           ; month/year
 * time-hour       = 2DIGIT  ; 00-23
 * time-minute     = 2DIGIT  ; 00-59
 * time-second     = 2DIGIT  ; 00-58, 00-59, 00-60 based on leap second
 *                           ; rules
 * time-secfrac    = "." 1*DIGIT
 * time-numoffset  = ("+" / "-") time-hour ":" time-minute
 * time-offset     = "Z" / time-numoffset
 * partial-time    = time-hour ":" time-minute ":" time-second
 *                   [time-secfrac]
 * full-date       = date-fullyear "-" date-month "-" date-mday
 * full-time       = partial-time time-offset
 * date-time       = full-date "T" full-time
 * ```
 */
const DATETIME_REGEX =
  /^(?<full_year>[0-9]{4})-(?<date_month>0[1-9]|1[012])-(?<date_mday>[0-2][0-9]|3[01])T(?<time_hour>[0-1][0-9]|2[0-3]):(?<time_minute>[0-5][0-9]):(?<time_second>[0-5][0-9]|60)(?<time_secfrac>\.[0-9]+)?(?<time_offset>Z|(?<time_numoffset>[+-](?:[0-1][0-9]|2[0-3]):[0-5][0-9]))$/

/**
 * Validates that the input is a datetime string according to atproto Lexicon
 * rules, and parses it into a Date object.
 */
function parseString(input: unknown): Result<AtprotoDate> {
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
    return failure(
      "datetime is not in a valid format (must match RFC 3339 & ISO 8601 with 'Z' or ±hh:mm timezone)",
    )
  }

  // must parse as ISO 8601; this also verifies semantics like leap seconds and
  // correct number of days in month, which the regex does not check for
  const date = new Date(input)

  return parseDate(date)
}

/**
 * Ensures that a Date object represents a valid datetime according to atproto
 * Lexicon rules. This ensures that `date.toISOString()` will produce a valid
 * datetime string that can be used where {@link DatetimeString} is expected.
 */
function parseDate(date: Date): Result<AtprotoDate> {
  const fullYear = date.getUTCFullYear()
  // Ensures that the date is valid. We could check isNaN(date.getTime()) here
  // but since we'll check the year anyway, we just use that for the validity
  // check since an invalid date will have NaN year.
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
  return success(date as AtprotoDate)
}
