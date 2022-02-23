export class TID {
  time: number
  clockid: number

  constructor(time: number, clockid: number) {
    this.time = time
    this.clockid = clockid
  }

  static now(): TID {
    const clockid = Math.floor(Math.random() * 1024)
    return new TID(Date.now(), clockid)
  }

  static parse(str: string): TID {
    const time = parseInt(str.slice(0, -2), 32)
    const clockid = parseInt(str.slice(-2), 32)
    return new TID(time, clockid)
  }

  static newestFirst(a: TID, b: TID): number {
    return a.compareTo(b) * -1
  }

  static oldestFirst(a: TID, b: TID): number {
    return a.compareTo(b)
  }

  toString(): string {
    return `${this.time.toString(32).padStart(9, '0')}${this.clockid
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
