import { blake3 } from '@noble/hashes/blake3'
import { sha256 } from '@noble/hashes/sha256'

const LANES = 1024
const LANE_BYTES = 2 // @NOTE cannot change without reworking the Uint16Array impl
export const LTHASH_STATE_BYTES = LANES * LANE_BYTES // 2048

/**
 * A homomorphic set hash. Each element expands to 1024 little-endian u16 lanes
 * which are summed into the state mod 2^16. Addition and subtraction commute, so
 * the state depends only on the current set, not on insertion order.
 */
export class LtHash {
  // Two views over one buffer: bytes for I/O, lanes for u16 arithmetic (which
  // wraps mod 2^16 on its own).
  private readonly bytes: Uint8Array
  private readonly lanes: Uint16Array

  constructor(state?: Uint8Array | null) {
    if (state && state.length !== LTHASH_STATE_BYTES) {
      throw new Error(
        `LtHash state must be ${LTHASH_STATE_BYTES} bytes, got ${state.length}`,
      )
    }
    const buffer = new ArrayBuffer(LTHASH_STATE_BYTES)
    this.bytes = new Uint8Array(buffer)
    this.lanes = new Uint16Array(buffer)
    if (state) this.bytes.set(state)
  }

  add(element: string): this {
    const lanes = expand(element)
    for (let i = 0; i < LANES; i++) {
      this.lanes[i] += lanes[i]
    }
    return this
  }

  remove(element: string): this {
    const lanes = expand(element)
    for (let i = 0; i < LANES; i++) {
      this.lanes[i] -= lanes[i]
    }
    return this
  }

  // The full state, for persistence.
  state(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  digest(): Uint8Array {
    return sha256(this.bytes)
  }

  isEmpty(): boolean {
    for (let i = 0; i < LANES; i++) {
      if (this.lanes[i] !== 0) return false
    }
    return true
  }

  equals(other: LtHash): boolean {
    for (let i = 0; i < LANES; i++) {
      if (this.lanes[i] !== other.lanes[i]) return false
    }
    return true
  }
}

// Expand to 1024 u16 lanes with BLAKE3 in XOF mode.
const expand = (element: string): Uint16Array => {
  const expanded = blake3(new TextEncoder().encode(element), {
    dkLen: LTHASH_STATE_BYTES,
  })
  // Copy: the result may be a view at an offset a Uint16Array can't straddle.
  const buffer = new ArrayBuffer(LTHASH_STATE_BYTES)
  new Uint8Array(buffer).set(expanded)
  return new Uint16Array(buffer)
}
