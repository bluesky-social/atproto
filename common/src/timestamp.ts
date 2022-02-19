export class Timestamp {

  time: number
  clockid: number

  constructor(time: number, clockid: number) {
    this.time = time
    this.clockid = clockid
  }

  static now(): Timestamp {
    const clockid = Math.floor(Math.random() * 1024)
    return new Timestamp(Date.now(), clockid)
  }

  static parse(str: string): Timestamp {
    const time = parseInt(str.slice(0,-2), 32)
    const clockid = parseInt(str.slice(-2), 32)
    return new Timestamp(time, clockid)
  }

  static newestFirst(a: Timestamp, b:Timestamp): number {
    return a.compareTo(b) * -1
  }

  static oldestFirst(a: Timestamp, b: Timestamp): number {
    return a.compareTo(b)
  }

  toString(): string {
    return `${this.time.toString(32).padStart(9, '0')}${this.clockid.toString(32).padStart(2, '0')}`
  }

  // newer > older
  compareTo(other: Timestamp): number {
    if (this.time > other.time) return 1
    if (this.time < other.time) return -1
    if (this.clockid > other.clockid) return 1
    if (this.clockid < other.clockid) return 1
    return 0
  }

  equals(other: Timestamp): boolean {
    return this.compareTo(other) === 0
  }

  newerThan(other: Timestamp): boolean {
    return this.compareTo(other) > 0
  }

  olderThan(other: Timestamp): boolean {
    return this.compareTo(other) < 0
  }
} 

export default Timestamp
