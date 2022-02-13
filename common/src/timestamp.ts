export class Timestamp {

  time: number
  clockid: number

  constructor(time?: number, clockid?: number) {
    this.time = time || Date.now()
    this.clockid = clockid || Math.floor(Math.random() * 1024)
  }

  static parse(str: string): Timestamp {
    // @TODO: make this base32
    const time = parseInt(str.slice(0,-4))
    const clockid = parseInt(str.slice(-4))
    return new Timestamp(time, clockid)
  }

  toString(): string {
    // @TODO: make this base32
    return `${this.time}${this.clockid}`
  }
} 

export default Timestamp
