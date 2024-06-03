/*
Grammar:

alpha     = "a" / "b" / "c" / "d" / "e" / "f" / "g" / "h" / "i" / "j" / "k" / "l" / "m" / "n" / "o" / "p" / "q" / "r" / "s" / "t" / "u" / "v" / "w" / "x" / "y" / "z" / "A" / "B" / "C" / "D" / "E" / "F" / "G" / "H" / "I" / "J" / "K" / "L" / "M" / "N" / "O" / "P" / "Q" / "R" / "S" / "T" / "U" / "V" / "W" / "X" / "Y" / "Z"
number    = "1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9" / "0"
delim     = "."
segment   = alpha *( alpha / number / "-" )
authority = segment *( delim segment )
name      = alpha *( alpha )
nsid      = authority delim name

*/

export class NSID {
  segments: string[] = []

  static parse(nsid: string): NSID {
    return new NSID(nsid)
  }

  static create(authority: string, name: string): NSID {
    const segments = [...authority.split('.').reverse(), name].join('.')
    return new NSID(segments)
  }

  static isValid(nsid: string): boolean {
    try {
      NSID.parse(nsid)
      return true
    } catch (e) {
      return false
    }
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

// Human readable constraints on NSID:
// - a valid domain in reversed notation
// - followed by an additional period-separated name, which is camel-case letters
export const ensureValidNsid = (nsid: string): void => {
  const toCheck = nsid

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]*$/.test(toCheck)) {
    throw new InvalidNsidError(
      'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
    )
  }

  if (toCheck.length > 253 + 1 + 63) {
    throw new InvalidNsidError('NSID is too long (317 chars max)')
  }
  const labels = toCheck.split('.')
  if (labels.length < 3) {
    throw new InvalidNsidError('NSID needs at least three parts')
  }
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]
    if (l.length < 1) {
      throw new InvalidNsidError('NSID parts can not be empty')
    }
    if (l.length > 63) {
      throw new InvalidNsidError('NSID part too long (max 63 chars)')
    }
    if (l.endsWith('-') || l.startsWith('-')) {
      throw new InvalidNsidError('NSID parts can not start or end with hyphen')
    }
    if (/^[0-9]/.test(l) && i === 0) {
      throw new InvalidNsidError('NSID first part may not start with a digit')
    }
    if (!/^[a-zA-Z]+$/.test(l) && i + 1 === labels.length) {
      throw new InvalidNsidError('NSID name part must be only letters')
    }
  }
}

export const ensureValidNsidRegex = (nsid: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (
    !/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\.[a-zA-Z]([a-zA-Z]{0,61}[a-zA-Z])?)$/.test(
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
