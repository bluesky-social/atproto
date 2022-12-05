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

const SEGMENT_RE = /^[a-zA-Z]([a-zA-Z0-9-])*$/

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
    const segments = nsid.split('.')
    if (segments.length <= 2) {
      throw new Error(`Invalid NSID: ${nsid}`)
    }
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (SEGMENT_RE.test(segment)) {
        continue
      }
      if (i === segments.length - 1 && segment === '*') {
        continue
      }
      throw new Error(`Invalid NSID: invalid character in segment "${segment}"`)
    }
    this.segments = segments
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
