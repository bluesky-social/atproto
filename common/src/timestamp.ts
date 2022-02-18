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

  toString(): string {
    return `${this.time.toString(32).padStart(9, '0')}${this.clockid.toString(32).padStart(2, '0')}`
  }

  compare(other: Timestamp): number {
    const strA = this.toString()
    const strB = other.toString()
    if (strA === strB) return 0
    if (strA > strB) return 1
    return -1
  }
} 

export default Timestamp
