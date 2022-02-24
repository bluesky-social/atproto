let lastTimestamp = 0
let timestampCount = 0

export class TID {
  time: number
  clockid: number

  constructor(time: number, clockid: number) {
    this.time = time
    this.clockid = clockid
  }

  static now(): TID {
    // javascript does not have microsecond precision
    // instead, we append a counter to the timestamp to indicate if multiple timestamps were created within the same millisecond
    const time = Date.now()
    if (time === lastTimestamp) {
      timestampCount++
    }
    lastTimestamp = time
    const timestamp = time * 1000 + timestampCount
    const clockid = Math.floor(Math.random() * 32) // the bottom 32 clock ids are not guaranteed to be collision resistant
    return new TID(timestamp, clockid)
  }

  static parse(str: string): TID {
    const time = parseInt(str.slice(0, -2), 32)
    const clockid = parseInt(str.slice(-2), 32)
    if (isNaN(time) || isNaN(clockid)) {
      throw new Error('Not a valid TID')
    }
    return new TID(time, clockid)
  }

  static newestFirst(a: TID, b: TID): number {
    return a.compareTo(b) * -1
  }

  static oldestFirst(a: TID, b: TID): number {
    return a.compareTo(b)
  }

  formatted(): string {
    const str = this.toString()
    return `${str.slice(0, 4)}-${str.slice(4, 7)}-${str.slice(
      7,
      11,
    )}-${str.slice(11, 13)}`
  }

  toString(): string {
    return `${this.time.toString(32)}${this.clockid
      .toString(32)
      .padStart(2, '0')}`
  }

  // newer > older
  compareTo(other: TID): number {
    if (this.time > other.time) return 1
    if (this.time < other.time) return -1
    if (this.clockid > other.clockid) return 1
    if (this.clockid < other.clockid) return 1
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
