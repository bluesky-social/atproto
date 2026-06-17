import { fromString } from 'uint8arrays/from-string'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'
import { Base64Alphabet } from './uint8array-base64.js'

const Buffer = NodeJSBuffer

export const utf8FromBase64Node = Buffer
  ? function utf8FromBase64Node(
      b64: string,
      alphabet: Base64Alphabet = 'base64',
    ): string {
      return Buffer.from(b64, alphabet).toString('utf8')
    }
  : /* v8 ignore next -- @preserve */ null

const textDecoder = /*#__PURE__*/ new TextDecoder()
export function utf8FromBase64Ponyfill(
  b64: string,
  alphabet?: Base64Alphabet,
): string {
  const bytes = fromString(b64, alphabet)
  return textDecoder.decode(bytes)
}
