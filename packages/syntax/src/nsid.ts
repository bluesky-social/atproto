/*
Grammar:

alpha     = "a" / "b" / "c" / "d" / "e" / "f" / "g" / "h" / "i" / "j" / "k" / "l" / "m" / "n" / "o" / "p" / "q" / "r" / "s" / "t" / "u" / "v" / "w" / "x" / "y" / "z" / "A" / "B" / "C" / "D" / "E" / "F" / "G" / "H" / "I" / "J" / "K" / "L" / "M" / "N" / "O" / "P" / "Q" / "R" / "S" / "T" / "U" / "V" / "W" / "X" / "Y" / "Z"
number    = "1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9" / "0"
delim     = "."
segment   = alpha *( alpha / number / "-" )
authority = segment *( delim segment )
name      = alpha *( alpha / number )
nsid      = authority delim name

*/

export type NsidString = `${string}.${string}.${string}`

export class NSID {
  readonly segments: readonly string[]

  static parse(input: string): NSID {
    return new NSID(input)
  }

  static create(authority: string, name: string): NSID {
    const input = [...authority.split('.').reverse(), name].join('.')
    return new NSID(input)
  }

  static isValid(nsid: string) {
    return isValidNsid(nsid)
  }

  static from(input: { toString: () => string }): NSID {
    if (input instanceof NSID) {
      // No need to clone, NSID is immutable
      return input
    }
    if (Array.isArray(input)) {
      return new NSID((input as string[]).join('.'))
    }
    return new NSID(String(input))
  }

  constructor(nsid: string) {
    this.segments = parseNsid(nsid)
  }

  get authority() {
    return this.segments
      .slice(0, this.segments.length - 1)
      .reverse()
      .join('.')
  }

  get name() {
    return this.segments.at(this.segments.length - 1)
  }

  toString() {
    return this.segments.join('.')
  }
}

export function ensureValidNsid(nsid: string): asserts nsid is NsidString {
  const result = validateNsid(nsid)
  if (!result.success) throw new InvalidNsidError(result.message)
}

export function parseNsid(nsid: string): string[] {
  const result = validateNsid(nsid)
  if (!result.success) throw new InvalidNsidError(result.message)
  return result.value
}

export function isValidNsid(nsid: string): nsid is NsidString {
  // Since the regex version is more performant for valid NSIDs, we use it when
  // we don't care about error details.
  return validateNsidRegex(nsid).success
}

type ValidateResult<T> =
  | { success: true; value: T }
  | { success: false; message: string }

// Human readable constraints on NSID:
// - a valid domain in reversed notation
// - followed by an additional period-separated name, which is camel-case letters
export function validateNsid(input: string): ValidateResult<string[]> {
  if (input.length > 253 + 1 + 63) {
    return {
      success: false,
      message: 'NSID is too long (317 chars max)',
    }
  }
  if (hasDisallowedCharacters(input)) {
    return {
      success: false,
      message:
        'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
    }
  }
  const segments = input.split('.')
  if (segments.length < 3) {
    return {
      success: false,
      message: 'NSID needs at least three parts',
    }
  }
  for (const l of segments) {
    if (l.length < 1) {
      return {
        success: false,
        message: 'NSID parts can not be empty',
      }
    }
    if (l.length > 63) {
      return {
        success: false,
        message: 'NSID part too long (max 63 chars)',
      }
    }
    if (startsWithHyphen(l) || endsWithHyphen(l)) {
      return {
        success: false,
        message: 'NSID parts can not start or end with hyphen',
      }
    }
  }
  if (startsWithNumber(segments[0])) {
    return {
      success: false,
      message: 'NSID first part may not start with a digit',
    }
  }
  if (!isValidIdentifier(segments[segments.length - 1])) {
    return {
      success: false,
      message:
        'NSID name part must be only letters and digits (and no leading digit)',
    }
  }
  return {
    success: true,
    value: segments,
  }
}

function hasDisallowedCharacters(v: string) {
  return !/^[a-zA-Z0-9.-]*$/.test(v)
}

function startsWithNumber(v: string) {
  const charCode = v.charCodeAt(0)
  return charCode >= 48 && charCode <= 57
}

function startsWithHyphen(v: string) {
  return v.charCodeAt(0) === 45 /* - */
}

function endsWithHyphen(v: string) {
  return v.charCodeAt(v.length - 1) === 45 /* - */
}

function isValidIdentifier(v: string) {
  // Note, since we already know that "v" only contains [a-zA-Z0-9-], we can
  // simplify the following regex by checking only the first char and presence
  // of "-".

  // return /^[a-zA-Z][a-zA-Z0-9]*$/.test(v)
  return !startsWithNumber(v) && !v.includes('-')
}

/**
 * @deprecated Use {@link ensureValidNsid} if you care about error details,
 * {@link parseNsid}/{@link NSID.parse} if you need the parsed segments, or
 * {@link isValidNsid} if you just want a boolean.
 */
export function ensureValidNsidRegex(nsid: string): asserts nsid is NsidString {
  const result = validateNsidRegex(nsid)
  if (!result.success) throw new InvalidNsidError(result.message)
}

/**
 * Regexp based validation that behaves identically to the previous code but
 * provides less detailed error messages (while being 20% to 50% faster).
 */
export function validateNsidRegex(value: string): ValidateResult<NsidString> {
  if (value.length > 253 + 1 + 63) {
    return {
      success: false,
      message: 'NSID is too long (317 chars max)',
    }
  }

  if (
    !/^[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?:\.[a-zA-Z](?:[a-zA-Z0-9]{0,62})?)$/.test(
      value,
    )
  ) {
    return {
      success: false,
      message: "NSID didn't validate via regex",
    }
  }

  return {
    success: true,
    value: value as NsidString,
  }
}

export class InvalidNsidError extends Error {}
