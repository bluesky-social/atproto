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

export class NSID {
  segments: string[] = []

  static parse(nsid: string): NSID {
    return new NSID(nsid)
  }

  static create(authority: string, name: string): NSID {
    const nsid = [...authority.split('.').reverse(), name].join('.')
    return new NSID(nsid)
  }

  static isValid(nsid: string) {
    return isValidNsid(nsid)
  }

  constructor(nsid: string) {
    ensureValidNsid(nsid)
    this.segments = nsid.split('.')
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

export function ensureValidNsid(nsid: string): void {
  const result = validateNsid(nsid)
  if (result != null) throw new InvalidNsidError(result)
}

export function isValidNsid(nsid: string): boolean {
  return validateNsid(nsid) == null
}

// Human readable constraints on NSID:
// - a valid domain in reversed notation
// - followed by an additional period-separated name, which is camel-case letters
export function validateNsid(value: string): string | null {
  const { length } = value
  if (length > 253 + 1 + 63) {
    return 'NSID is too long (317 chars max)'
  }

  let partCount = 1
  let partStart = 0
  let partHasLeadingDigit = false
  let partHasHyphen = false

  let charCode: number
  for (let i = 0; i < length; i++) {
    charCode = value.charCodeAt(i)

    // Hot path: check frequent chars first
    if (
      (charCode >= 97 && charCode <= 122) /* a-z */ ||
      (charCode >= 65 && charCode <= 90) /* A-Z */
    ) {
      // All good
    } else if (charCode >= 48 && charCode <= 57 /* 0-9 */) {
      if (i === 0) {
        return 'NSID first part may not start with a digit'
      }

      // All good

      if (i === partStart) {
        partHasLeadingDigit = true
      }
    } else if (charCode === 45 /* - */) {
      if (i === partStart) {
        return 'NSID part can not start with hyphen'
      }
      if (i === length - 1 || value.charCodeAt(i + 1) === 46 /* . */) {
        return 'NSID part can not end with hyphen'
      }

      // All good

      partHasHyphen = true
    } else if (charCode === 46 /* . */) {
      // Check prev part size
      if (i === partStart) {
        return 'NSID parts can not be empty'
      }
      if (i - partStart > 63) {
        return 'NSID part too long (max 63 chars)'
      }

      // All good

      partCount++
      partStart = i + 1
      partHasHyphen = false
      partHasLeadingDigit = false
    } else {
      return 'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)'
    }
  }

  // Check last part size
  if (length === partStart) {
    return 'NSID parts can not be empty'
  }
  if (length - partStart > 63) {
    return 'NSID part too long (max 63 chars)'
  }

  // Check last part chars
  if (partHasHyphen || partHasLeadingDigit) {
    return 'NSID name part must be only letters and digits (and no leading digit)'
  }

  // Check part count
  if (partCount < 3) {
    return 'NSID needs at least three parts'
  }

  return null
}

/** @deprecated use {@link ensureValidNsid} */
export const ensureValidNsidRegex = (nsid: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (
    !/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\.[a-zA-Z]([a-zA-Z0-9]{0,62})?)$/.test(
      nsid,
    )
  ) {
    throw new InvalidNsidError("NSID didn't validate via regex")
  }
  if (nsid.length > 253 + 1 + 63) {
    throw new InvalidNsidError('NSID is too long (317 chars max)')
  }
}

export class InvalidNsidError extends Error {}
