import { s32encode, s32decode } from './util'
let lastTimestamp = 0
let timestampCount = 0
let clockid: number | null = null

export class TID {
  str: string

  constructor(str: string) {
    const noDashes = str.replace(/-/g, '')
    if (noDashes.length !== 13) {
      throw new Error(`Poorly formatted TID: ${noDashes.length} length`)
    }
    this.str = noDashes
  }

  static next(): TID {
    // javascript does not have microsecond precision
    // instead, we append a counter to the timestamp to indicate if multiple timestamps were created within the same millisecond
    // take max of current time & last timestamp to prevent tids moving backwards if system clock drifts backwards
    const time = Math.max(Date.now(), lastTimestamp)
    if (time === lastTimestamp) {
      timestampCount++
    }
    lastTimestamp = time
    const timestamp = time * 1000 + timestampCount
    // the bottom 32 clock ids can be randomized & are not guaranteed to be collision resistant
    // we use the same clockid for all tids coming from this machine
    if (clockid === null) {
      clockid = Math.floor(Math.random() * 32)
    }
    return TID.fromTime(timestamp, clockid)
  }

  static nextStr(): string {
    return TID.next().toString()
  }

  static fromTime(timestamp: number, clockid: number): TID {
    // base32 encode with encoding variant sort (s32)
    const str = `${s32encode(timestamp)}${s32encode(clockid).padStart(2, '2')}`
    return new TID(str)
  }

  static fromStr(str: string): TID {
    return new TID(str)
  }

  static newestFirst(a: TID, b: TID): number {
    return a.compareTo(b) * -1
  }

  static oldestFirst(a: TID, b: TID): number {
    return a.compareTo(b)
  }

  static is(str: string): boolean {
    try {
      TID.fromStr(str)
      return true
    } catch (err) {
      return false
    }
  }

  timestamp(): number {
    const substr = this.str.slice(0, 11)
    return s32decode(substr)
  }

  clockid(): number {
    const substr = this.str.slice(11, 13)
    return s32decode(substr)
  }

  formatted(): string {
    const str = this.toString()
    return `${str.slice(0, 4)}-${str.slice(4, 7)}-${str.slice(
      7,
      11,
    )}-${str.slice(11, 13)}`
  }

  toString(): string {
    return this.str
  }

  // newer > older
  compareTo(other: TID): number {
    if (this.str > other.str) return 1
    if (this.str < other.str) return -1
    return 0
  }

  equals(other: TID): boolean {
    return this.compareTo(other) === 0
  }

  newerThan(other: TID): boolean {
    return this.compareTo(other) > 0
  }

  olderThan(other: TID): boolean {
    return this.compareTo(other) < 0
  }
}

export default TID
