import { webcrypto } from 'one-webcrypto'

export const randomBytes = (length: number): Uint8Array => {
  return webcrypto.getRandomValues(new Uint8Array(length))
}

export const randomIV = (): Uint8Array => {
  return randomBytes(12)
}
