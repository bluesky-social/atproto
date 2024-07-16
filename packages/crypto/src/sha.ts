import * as noble from '@noble/hashes/sha256'
import * as uint8arrays from 'uint8arrays'

// takes either bytes of utf8 input
// @TODO this can be sync
export const sha256 = async (
  input: Uint8Array | string,
): Promise<Uint8Array> => {
  const bytes =
    typeof input === 'string' ? uint8arrays.fromString(input, 'utf8') : input
  return noble.sha256(bytes)
}

// @TODO this can be sync
export const sha256Hex = async (
  input: Uint8Array | string,
): Promise<string> => {
  const hash = await sha256(input)
  return uint8arrays.toString(hash, 'hex')
}
