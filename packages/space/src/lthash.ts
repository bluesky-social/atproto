import { blake3 } from '@noble/hashes/blake3'
import { sha256 } from '@noble/hashes/sha256'

const LANES = 1024
const LANE_BYTES = 2 // @NOTE this value cannot change without also changing the impl which relies on Uint16Arrays
const STATE_BYTES = LANES * LANE_BYTES // 2048

// Uint16Array views read in host byte order. We pin the on-disk and
// on-wire format to little-endian, so we'd need to byteswap on a BE host.
// Node has no big-endian targets in practice, but assert it once at load
// time rather than silently miscompare cross-platform.
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
  throw new Error('LtHash requires a little-endian host')
}

export class LtHash {
  // Two views over the same buffer: bytes for I/O, lanes for u16 arithmetic.
  // Writes through `lanes` land little-endian because we asserted host LE.
  // Arithmetic on Uint16Array elements wraps mod 2^16 automatically.
  private bytes: Uint8Array
  private lanes: Uint16Array

  constructor(init?: Uint8Array) {
    if (init && init.length !== STATE_BYTES) {
      throw new Error(
        `LtHash state must be ${STATE_BYTES} bytes, got ${init.length}`,
      )
    }
    const buf = new ArrayBuffer(STATE_BYTES)
    this.bytes = new Uint8Array(buf)
    this.lanes = new Uint16Array(buf)
    if (init !== undefined) {
      for (let i = 0; i < STATE_BYTES; i++) {
        this.bytes[i] = init[i]
      }
    }
  }

  static fromHex(hex: string): LtHash {
    return new LtHash(Buffer.from(hex, 'hex'))
  }

  add(element: string): void {
    const lanes = expand(element)
    for (let i = 0; i < LANES; i++) {
      this.lanes[i] += lanes[i]
    }
  }

  remove(element: string): void {
    const lanes = expand(element)
    for (let i = 0; i < LANES; i++) {
      this.lanes[i] -= lanes[i]
    }
  }

  // Full lattice state — for storage. 2048 bytes, little-endian.
  toBytes(): Buffer {
    const out = Buffer.alloc(STATE_BYTES)
    for (let i = 0; i < STATE_BYTES; i++) {
      out[i] = this.bytes[i]
    }
    return out
  }

  // Protocol commitment digest — sha256 of state. 32 bytes.
  digest(): Buffer {
    return Buffer.from(sha256(this.toBytes()))
  }

  equals(other: LtHash): boolean {
    if (this.lanes.length !== other.lanes.length) {
      return false
    }
    for (let i = 0; i < this.lanes.length; i++) {
      if (this.lanes[i] !== other.lanes[i]) {
        return false
      }
    }
    return true
  }
}

// Expand an element to 1024 u16 lanes via BLAKE3 in XOF mode.
const expand = (element: string): Uint16Array => {
  const expanded = blake3(new TextEncoder().encode(element), {
    dkLen: STATE_BYTES,
  })
  const buf = new ArrayBuffer(STATE_BYTES)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < STATE_BYTES; i++) {
    bytes[i] = expanded[i]
  }
  return new Uint16Array(buf)
}
