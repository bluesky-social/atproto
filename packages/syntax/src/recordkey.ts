export type RecordKeyString = string

const RECORD_KEY_MAX_LENGTH = 512
const RECORD_KEY_MIN_LENGTH = 1
const RECORD_KEY_INVALID_VALUES = new Set(['.', '..'])
const RECORD_KEY_REGEX = /^[a-zA-Z0-9_~.:-]{1,512}$/

// https://atproto.com/specs/record-key#record-key-syntax
// Regardless of the type, Record Keys must fulfill some baseline syntax constraints:
// - restricted to a subset of ASCII characters -- the allowed characters are
//   alphanumeric (A-Za-z0-9), period, dash, underscore, colon, or tilde (.-_:~)
// - must have at least 1 and at most 512 characters
// - the specific record key values . and .. are not allowed
// - must be a permissible part of repository MST path string (the above
//   constraints satisfy this condition)
// - must be permissible to include in a path component of a URI (following
//   RFC-3986, section 3.3). The above constraints satisfy this condition, by
//   matching the "unreserved" characters allowed in generic URI paths.

export function ensureValidRecordKey(
  rkey: string,
): asserts rkey is RecordKeyString {
  if (
    rkey.length > RECORD_KEY_MAX_LENGTH ||
    rkey.length < RECORD_KEY_MIN_LENGTH
  ) {
    throw new InvalidRecordKeyError(
      `record key must be ${RECORD_KEY_MIN_LENGTH} to ${RECORD_KEY_MAX_LENGTH} characters`,
    )
  }
  if (RECORD_KEY_INVALID_VALUES.has(rkey)) {
    throw new InvalidRecordKeyError('record key can not be "." or ".."')
  }
  // simple regex to enforce most constraints via just regex and length.
  if (!RECORD_KEY_REGEX.test(rkey)) {
    throw new InvalidRecordKeyError('record key syntax not valid (regex)')
  }
}

export function isValidRecordKey(rkey: string): rkey is RecordKeyString {
  return (
    rkey.length >= RECORD_KEY_MIN_LENGTH &&
    rkey.length <= RECORD_KEY_MAX_LENGTH &&
    RECORD_KEY_REGEX.test(rkey) &&
    !RECORD_KEY_INVALID_VALUES.has(rkey)
  )
}

export class InvalidRecordKeyError extends Error {}
