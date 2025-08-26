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

export function ensureValidNsid(nsid: string): void {
  const result = validateNsid(nsid)
  if (!result.success) throw new InvalidNsidError(result.message)
}

export function parseNsid(nsid: string): string[] {
  const result = validateNsid(nsid)
  if (!result.success) throw new InvalidNsidError(result.message)
  return result.value
}

export function isValidNsid(nsid: string): boolean {
  return validateNsid(nsid).success
}

// Human readable constraints on NSID:
// - a valid domain in reversed notation
// - followed by an additional period-separated name, which is camel-case letters
export function validateNsid(
  value: string,
): { success: true; value: string[] } | { success: false; message: string } {
  if (value.length > 253 + 1 + 63) {
    return {
      success: false,
      message: 'NSID is too long (317 chars max)',
    }
  }
  if (startsWithNumber(value)) {
    return {
      success: false,
      message: 'NSID first part may not start with a digit',
    }
  }
  if (!/^[a-zA-Z0-9.-]*$/.test(value)) {
    return {
      success: false,
      message:
        'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
    }
  }
  const labels = value.split('.')
  if (labels.length < 3) {
    return {
      success: false,
      message: 'NSID needs at least three parts',
    }
  }
  if (!isValidIdentifier(labels[labels.length - 1])) {
    return {
      success: false,
      message:
        'NSID name part must be only letters and digits (and no leading digit)',
    }
  }
  for (const l of labels) {
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
  return {
    success: true,
    value: labels,
  }
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
  return /^[a-zA-Z][a-zA-Z0-9]*$/.test(v)
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
