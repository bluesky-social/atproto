import * as uint8arrays from 'uint8arrays'

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
