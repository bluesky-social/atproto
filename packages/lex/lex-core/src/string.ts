import { NodeJSBuffer } from './lib/nodejs-buffer.js'

export function utf8Len(string: string): number {
  // Optimization: use NodeJS Buffer if available as it is twice as fast
  if (NodeJSBuffer) return NodeJSBuffer.byteLength(string)

  // The code below is similar to TextEncoder's implementation of UTF-8
  // encoding. However, using TextEncoder to get the byte length is slower as it
  // requires allocating a new Uint8Array and copying data:

  // return new TextEncoder().encode(string).byteLength

  let len = string.length
  let code: number

  for (let i = 0; i < string.length; i += 1) {
    code = string.charCodeAt(i)

    if (code <= 0x7f) {
      // ASCII, 1 byte
    } else if (code <= 0x7ff) {
      // 2 bytes char
      len += 1
    } else {
      // 3 bytes char
      len += 2
      // If the current char is a high surrogate, and the next char is a low
      // surrogate, skip the next char as the total is a 4 bytes char
      // (represented as a surrogate pair in UTF-16) and was already accounted
      // for.
      if (code >= 0xd800 && code <= 0xdbff) {
        code = string.charCodeAt(i + 1)
        if (code >= 0xdc00 && code <= 0xdfff) {
          i++
        }
      }
    }
  }

  return len
}

const segmenter = /*#__PURE__*/ new Intl.Segmenter()
export function graphemeLen(str: string) {
  let length = 0
  for (const _ of segmenter.segment(str)) length++
  return length
}
