import { webcrypto } from 'one-webcrypto'
import * as uint8arrays from 'uint8arrays'

// takes either bytes of utf8 input
export const sha256 = async (
  input: Uint8Array | string,
): Promise<Uint8Array> => {
  const bytes =
    typeof input === 'string' ? uint8arrays.fromString(input, 'utf8') : input
  const hash = await webcrypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(hash)
}
