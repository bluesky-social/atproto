import { toBase64 } from '@atproto/lex-data'

// Byte-level helpers used within this package. Not part of its public API.

export function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Big-endian, following the TLS convention for wire encodings.
export function uint16be(value: number): Uint8Array {
  if (value < 0 || value > 0xffff) {
    throw new Error(`value does not fit in a uint16: ${value}`)
  }
  return new Uint8Array([value >>> 8, value & 0xff])
}

// Compares in time independent of where the inputs differ, for checking MACs.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

// Structured field byte sequences are serialized as padded base64 (RFC 9651
// §4.1.8), while `toBase64` omits padding.
export function toPaddedBase64(bytes: Uint8Array): string {
  const base64 = toBase64(bytes)
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}

// Lexicographic byte order: the first differing byte decides, and a prefix sorts
// before any longer key it starts.
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}
