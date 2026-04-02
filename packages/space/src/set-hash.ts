import { sha256 } from '@atproto/crypto'

// Currently just an XOR-of-hashes for simplicity
// Will likely switch out for ECMH or ltHash
export class SetHash {
  private state: Buffer

  constructor(init?: Buffer | string) {
    if (init === undefined) {
      this.state = Buffer.alloc(32)
    } else if (typeof init === 'string') {
      this.state = Buffer.from(init, 'hex')
    } else {
      this.state = Buffer.from(init)
    }
  }

  async add(element: string): Promise<void> {
    const hash = await sha256(element)
    this.state = xor(this.state, Buffer.from(hash))
  }

  async remove(element: string): Promise<void> {
    // XOR is its own inverse
    await this.add(element)
  }

  toBytes(): Buffer {
    return Buffer.from(this.state)
  }

  toHex(): string {
    return this.state.toString('hex')
  }

  equals(other: SetHash): boolean {
    return this.state.equals(other.toBytes())
  }
}

const xor = (a: Buffer, b: Buffer): Buffer => {
  if (a.length !== b.length) {
    throw new Error('Byte arrays must be the same length')
  }
  const result = Buffer.alloc(a.length)
  for (let i = 0; i < result.length; i++) {
    result[i] = a[i] ^ b[i]
  }
  return result
}
