import { webcrypto } from 'one-webcrypto'

export const randomIV = (): Uint8Array => {
  return webcrypto.getRandomValues(new Uint8Array(12))
}
