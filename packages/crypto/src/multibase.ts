import * as uint8arrays from 'uint8arrays'
import { SupportedEncodings } from 'uint8arrays/to-string'

export const multibaseToBytes = (mb: string): Uint8Array => {
  const base = mb[0]
  const key = mb.slice(1)
  switch (base) {
    case 'f':
      return uint8arrays.fromString(key, 'base16')
    case 'F':
      return uint8arrays.fromString(key, 'base16upper')
    case 'b':
      return uint8arrays.fromString(key, 'base32')
    case 'B':
      return uint8arrays.fromString(key, 'base32upper')
    case 'z':
      return uint8arrays.fromString(key, 'base58btc')
    case 'm':
      return uint8arrays.fromString(key, 'base64')
    case 'u':
      return uint8arrays.fromString(key, 'base64url')
    case 'U':
      return uint8arrays.fromString(key, 'base64urlpad')
    default:
      throw new Error(`Unsupported multibase: :${mb}`)
  }
}

export const bytesToMultibase = (
  mb: Uint8Array,
  encoding: SupportedEncodings,
): string => {
  switch (encoding) {
    case 'base16':
      return 'f' + uint8arrays.toString(mb, encoding)
    case 'base16upper':
      return 'F' + uint8arrays.toString(mb, encoding)
    case 'base32':
      return 'b' + uint8arrays.toString(mb, encoding)
    case 'base32upper':
      return 'B' + uint8arrays.toString(mb, encoding)
    case 'base58btc':
      return 'z' + uint8arrays.toString(mb, encoding)
    case 'base64':
      return 'm' + uint8arrays.toString(mb, encoding)
    case 'base64url':
      return 'u' + uint8arrays.toString(mb, encoding)
    case 'base64urlpad':
      return 'U' + uint8arrays.toString(mb, encoding)
    default:
      throw new Error(`Unsupported multibase: :${mb}`)
  }
}
