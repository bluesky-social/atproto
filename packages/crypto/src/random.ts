import * as noble from '@noble/hashes/utils'
import * as uint8arrays from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/to-string'

export const randomBytes = noble.randomBytes

export const randomStr = (
  byteLength: number,
  encoding: SupportedEncodings,
): string => {
  const bytes = randomBytes(byteLength)
  return uint8arrays.toString(bytes, encoding)
}
