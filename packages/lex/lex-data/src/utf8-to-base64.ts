import { toString } from 'uint8arrays/to-string'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'
import { Base64Alphabet } from './uint8array-base64.js'
import { toBase64Node } from './uint8array-to-base64.js'

const Buffer = NodeJSBuffer

export const utf8ToBase64Node = Buffer
  ? function utf8ToBase64Node(text: string, alphabet?: Base64Alphabet): string {
      const buffer = Buffer.from(text, 'utf8')
      return toBase64Node!(buffer, alphabet)
    }
  : /* v8 ignore next -- @preserve */ null

const textEncoder = /*#__PURE__*/ new TextEncoder()
export function utf8ToBase64Ponyfill(
  text: string,
  alphabet?: Base64Alphabet,
): string {
  const bytes = textEncoder.encode(text)
  return toString(bytes, alphabet)
}
