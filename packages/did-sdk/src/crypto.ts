import { webcrypto } from 'one-webcrypto'

export function secureRandom(size = 32): Uint8Array {
  const buf = new Uint8Array(size)
  webcrypto.getRandomValues(buf)
  return buf
}
