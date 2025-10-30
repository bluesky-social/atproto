import { timingSafeEqual } from 'node:crypto'
import { TextEncoder } from 'node:util'

const utf8Encoder = new TextEncoder()

// returns true if both strings are equal
export const timingSafeStringEqual = (a: string, b: string): boolean => {
  // NOTE: timing will still vary based on the *lengths* of the input strings

  const bufA = utf8Encoder.encode(a)
  const bufB = utf8Encoder.encode(b)

  // timingSafeEqual only works on buffers of equal length
  if (bufA.length !== bufB.length) {
    return false
  }

  return timingSafeEqual(bufA, bufB)
}
