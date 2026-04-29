import { s32decode, s32encode } from './util'

const TID_LEN = 13

let lastTimestamp = 0
let usCounter = 0

// javascript does not have microsecond precision. instead, we append a counter
// to the timestamp to indicate if multiple timestamps were created within the
// same millisecond take max of current time & last timestamp to prevent tids
// moving backwards if system clock drifts backwards
function timeUs(): number {
  const currentTimestamp = Date.now()

  if (lastTimestamp > currentTimestamp + 60e3) {
    // We created more than 1,000,000 TIDs per second for 1 minute. This is
    // extremely unlikely and could lead to too much drift, if continued. So we
    // bail out.
    throw new Error('Too many TIDs generated in a short time')
  }

  // Under high load, continue counting within the previous second if we are
  // still within it to avoid dropping too many available unique values
  // (preventing the drift from increasing uncontrollably). If the load is low,
  // we can reset the counter after each millisecond.
  const underHighLoad =
    lastTimestamp === currentTimestamp
      ? usCounter >= 500
      : lastTimestamp > currentTimestamp

  if (currentTimestamp > lastTimestamp + (underHighLoad ? 1e3 : 0)) {
    // We are enough in the future, reset counter
    usCounter = 0
    lastTimestamp = currentTimestamp
  } else if (usCounter === 999) {
    // We have generated 1,000 TIDs within the same millisecond, move to the
    // next millisecond to avoid collisions
    lastTimestamp++
    usCounter = 0
  } else {
    usCounter++
  }
  return lastTimestamp * 1000 + usCounter
}

// the bottom 32 clock ids can be randomized & are not guaranteed to be
// collision resistant we use the same clockid for all tids coming from this
// machine
const clockid: number = Math.floor(Math.random() * 32)

function dedash(str: string): string {
  return str.replaceAll('-', '')
}

export class TID {
  str: string

  constructor(str: string) {
    const noDashes = dedash(str)
    if (noDashes.length !== TID_LEN) {
      throw new Error(`Poorly formatted TID: ${noDashes.length} length`)
    }
    this.str = noDashes
  }

  static next(prev?: TID): TID {
    const timestamp = timeUs()

    const tid = TID.fromTime(timestamp, clockid)
    if (!prev || tid.newerThan(prev)) {
      return tid
    }
    return TID.fromTime(prev.timestamp() + 1, clockid)
  }

  static nextStr(prev?: string): string {
    return TID.next(prev ? new TID(prev) : undefined).toString()
  }

  static fromTime(timestamp: number, clockid: number): TID {
    // base32 encode with encoding variant sort (s32)
    const str = `${s32encode(timestamp)}${s32encode(clockid).padStart(2, '2')}`
    return new TID(str)
  }

  static fromStr(str: string): TID {
    return new TID(str)
  }

  static oldestFirst(a: TID, b: TID): number {
    return a.compareTo(b)
  }

  static newestFirst(a: TID, b: TID): number {
    return b.compareTo(a)
  }

  static is(str: string): boolean {
    return dedash(str).length === TID_LEN
  }

  timestamp(): number {
    return s32decode(this.str.slice(0, 11))
  }

  clockid(): number {
    return s32decode(this.str.slice(11, 13))
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
    return this.str === other.str
  }

  newerThan(other: TID): boolean {
    return this.compareTo(other) > 0
  }

  olderThan(other: TID): boolean {
    return this.compareTo(other) < 0
  }
}
