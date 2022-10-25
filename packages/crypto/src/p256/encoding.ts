import bigInt from 'big-integer'
import * as uint8arrays from 'uint8arrays'

// PUBLIC KEY COMPRESSION
// ------------------------

// Compression & Decompression algos from:
// https://stackoverflow.com/questions/48521840/biginteger-to-a-uint8array-of-bytes

// Public key compression for NIST P-256
export const compressPubkey = (pubkeyBytes: Uint8Array): Uint8Array => {
  if (pubkeyBytes.length !== 65) {
    throw new Error('Expected 65 byte pubkey')
  } else if (pubkeyBytes[0] !== 0x04) {
    throw new Error('Expected first byte to be 0x04')
  }
  // first byte is a prefix
  const x = pubkeyBytes.slice(1, 33)
  const y = pubkeyBytes.slice(33, 65)
  const out = new Uint8Array(x.length + 1)

  out[0] = 2 + (y[y.length - 1] & 1)
  out.set(x, 1)

  return out
}

// Public key decompression for NIST P-256
export const decompressPubkey = (compressed: Uint8Array): Uint8Array => {
  if (compressed.length !== 33) {
    throw new Error('Expected 33 byte compress pubkey')
  } else if (compressed[0] !== 0x02 && compressed[0] !== 0x03) {
    throw new Error('Expected first byte to be 0x02 or 0x03')
  }
  // Consts for P256 curve
  const two = bigInt(2)
  // 115792089210356248762697446949407573530086143415290314195533631308867097853951
  const prime = two
    .pow(256)
    .subtract(two.pow(224))
    .add(two.pow(192))
    .add(two.pow(96))
    .subtract(1)
  const b = bigInt(
    '41058363725152142129326129780047268409114441015993725554835256314039467401291',
  )

  // Pre-computed value, or literal
  const pIdent = prime.add(1).divide(4) // 28948022302589062190674361737351893382521535853822578548883407827216774463488

  // This value must be 2 or 3. 4 indicates an uncompressed key, and anything else is invalid.
  const signY = bigInt(compressed[0] - 2)
  const x = compressed.slice(1)
  const xBig = bigInt(uint8arrays.toString(x, 'base10'))

  // y^2 = x^3 - 3x + b
  const maybeY = xBig
    .pow(3)
    .subtract(xBig.multiply(3))
    .add(b)
    .modPow(pIdent, prime)

  let yBig
  // If the parity matches, we found our root, otherwise it's the other root
  if (maybeY.mod(2).equals(signY)) {
    yBig = maybeY
  } else {
    // y = prime - y
    yBig = prime.subtract(maybeY)
  }
  const y = uint8arrays.fromString(yBig.toString(10), 'base10')

  // left-pad for smaller than 32 byte y
  const offset = 32 - y.length
  const yPadded = new Uint8Array(32)
  yPadded.set(y, offset)

  // concat coords & prepend P-256 prefix
  const publicKey = uint8arrays.concat([[0x04], x, yPadded])
  return publicKey
}
