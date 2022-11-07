import * as uint8arrays from 'uint8arrays'
import { webcrypto } from 'one-webcrypto'
import { SupportedEncodings } from 'uint8arrays/to-string'

export const randomBytes = (length: number): Uint8Array => {
  return webcrypto.getRandomValues(new Uint8Array(length))
}

export const randomIV = (): Uint8Array => {
  return randomBytes(12)
}

export const randomStr = (
  byteLength: number,
  encoding: SupportedEncodings,
): string => {
  const bytes = randomBytes(byteLength)
  return uint8arrays.toString(bytes, encoding)
}
