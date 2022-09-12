import { sha256 } from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'
import { canonicaliseDocumentToUint8Array } from './signature'
import { Document } from './types'

const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz'

export const pid = async (
  data: Uint8Array | string | Document,
): Promise<string> => {
  if (data instanceof Uint8Array) {
    // return the pid120 a 24 char pid
    const hash = s32encode(await sha256(data))
    let twos = 0
    for (twos = 0; twos < 32; twos++) {
      if (hash[twos] !== '2') {
        break
      }
    }
    const head = S32_CHAR[31 - twos]
    const tail = hash.slice(twos, twos + 15) // 23 for pid120; 15 for pid80 // Are we ok with 80 bits?
    return head + tail
  }
  if (typeof data === 'string') {
    return pid(uint8arrays.fromString(data))
  }
  return pid(canonicaliseDocumentToUint8Array(data))
}

const s32encode = (data: Uint8Array) => {
  const bitsPerChar = 5
  const mask = (1 << bitsPerChar) - 1
  let out = ''

  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  for (let i = 0; i < data.length; ++i) {
    // Slurp data into the buffer:
    buffer = (buffer << 8) | data[i]
    bits += 8

    // Write out as much as we can:
    while (bits > bitsPerChar) {
      bits -= bitsPerChar
      out += S32_CHAR[mask & (buffer >> bits)]
    }
  }

  // Partial character:
  if (bits) {
    out += S32_CHAR[mask & (buffer << (bitsPerChar - bits))]
  }
  return out
}
