/*
Grammar:

alpha     = "a" / "b" / "c" / "d" / "e" / "f" / "g" / "h" / "i" / "j" / "k" / "l" / "m" / "n" / "o" / "p" / "q" / "r" / "s" / "t" / "u" / "v" / "w" / "x" / "y" / "z" / "A" / "B" / "C" / "D" / "E" / "F" / "G" / "H" / "I" / "J" / "K" / "L" / "M" / "N" / "O" / "P" / "Q" / "R" / "S" / "T" / "U" / "V" / "W" / "X" / "Y" / "Z"
number    = "1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9" / "0"
delim     = "."
segment   = alpha *( alpha / number / "-" )
authority = segment *( delim segment )
name      = segment
nsid      = authority delim name
nsid-ns   = authority delim "*"

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
// - a valid domain in reversed notation. which means the same as a loose domain!
export const ensureValidNsid = (nsid: string): void => {
  // to handle nsid-ns
  const split = nsid.split('.')
  const toCheck =
    split.at(-1) === '*' ? split.slice(0, -1).join('.') : split.join('.')

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]*$/.test(toCheck)) {
    throw new InvalidNsidError(
      'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
    )
  }

  if (toCheck.length > 253 + 1 + 128) {
    throw new InvalidNsidError('NSID is too long (382 chars max)')
  }
  const labels = toCheck.split('.')
  if (split.length < 3) {
    throw new InvalidNsidError('NSID needs at least three parts')
  }
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]
    if (l.length < 1) {
      throw new InvalidNsidError('NSID parts can not be empty')
    }
    if (l.length > 63 && i + 1 < labels.length) {
      throw new InvalidNsidError('NSID domain part too long (max 63 chars)')
    }
    if (l.length > 128 && i + 1 == labels.length) {
      throw new InvalidNsidError('NSID name part too long (max 127 chars)')
    }
    if (l.endsWith('-')) {
      throw new InvalidNsidError('NSID parts can not end with hyphen')
    }
    if (!/^[a-zA-Z]/.test(l)) {
      throw new InvalidNsidError('NSID parts must start with ASCII letter')
    }
  }
}

// nsid-ns is not handled in regex yet
export const ensureValidNsidRegex = (nsid: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (
    !/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\.[a-zA-Z]([a-zA-Z0-9-]{0,126}[a-zA-Z0-9])?)$/.test(
      nsid,
    )
  ) {
    throw new InvalidNsidError("NSID didn't validate via regex")
  }
  if (nsid.length > 253 + 1 + 128) {
    throw new InvalidNsidError('NSID is too long (382 chars max)')
  }
}

export class InvalidNsidError extends Error {}
