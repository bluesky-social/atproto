import { fromString } from 'uint8arrays/from-string'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'
import { Base64Alphabet } from './uint8array-base64.js'

const Buffer = NodeJSBuffer

declare global {
  interface Uint8ArrayConstructor {
    /**
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64 Uint8Array.fromBase64()}
     */
    fromBase64?: (
      b64: string,
      options?: {
        /** @default 'base64' */
        alphabet?: 'base64' | 'base64url'
        lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial'
      },
    ) => Uint8Array
  }
}

export const fromBase64Native =
  typeof Uint8Array.fromBase64 === 'function'
    ? function fromBase64Native(
        b64: string,
        alphabet: Base64Alphabet = 'base64',
      ): Uint8Array {
        return Uint8Array.fromBase64!(b64, {
          alphabet,
          lastChunkHandling: 'loose',
        })
      }
    : /* v8 ignore next -- @preserve */ null

export const fromBase64Node = Buffer
  ? function fromBase64Node(
      b64: string,
      alphabet: Base64Alphabet = 'base64',
    ): Uint8Array {
      const bytes = Buffer.from(b64, alphabet)
      verifyBase64ForBytes(b64, bytes)
      // Convert to Uint8Array because even though Buffer is a sub class of
      // Uint8Array, it serializes differently to Uint8Array (e.g. in JSON) and
      // results in unexpected behavior downstream (e.g. in tests)
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }
  : /* v8 ignore next -- @preserve */ null

export function fromBase64Ponyfill(
  b64: string,
  alphabet: Base64Alphabet = 'base64',
): Uint8Array {
  const bytes = fromString(b64, b64.endsWith('=') ? `${alphabet}pad` : alphabet)
  verifyBase64ForBytes(b64, bytes)
  return bytes
}

// @NOTE NodeJS will silently stop decoding at the first invalid character,
// while "uint8arrays/from-string" will not validate that the padding is
// correct. The following function performs basic validation to ensure that the
// input was a valid base64 string. The availability of the "bytes" allows
// to perform checks with O[1] complexity.
function verifyBase64ForBytes(b64: string, bytes: Uint8Array): void {
  const paddingCount = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  const trimmedLength = b64.length - paddingCount
  const expectedByteLength = Math.floor((trimmedLength * 3) / 4)
  if (bytes.length !== expectedByteLength) {
    throw new Error('Invalid base64 string')
  }

  const expectedB64Length = (bytes.length / 3) * 4
  const expectedPaddingCount =
    expectedB64Length % 4 === 0 ? 0 : 4 - (expectedB64Length % 4)
  const expectedFullB64Length = expectedB64Length + expectedPaddingCount
  if (b64.length > expectedFullB64Length) {
    throw new Error('Invalid base64 string')
  }

  // The previous might still allow false positive if only the last few
  // chars are invalid.
  for (
    let i = Math.ceil(expectedB64Length);
    i < b64.length - paddingCount;
    i++
  ) {
    const code = b64.charCodeAt(i)
    if (
      !(code >= 65 && code <= 90) && // A-Z
      !(code >= 97 && code <= 122) && // a-z
      !(code >= 48 && code <= 57) && // 0-9
      code !== 43 && // +
      code !== 47 // /
    ) {
      throw new Error('Invalid base64 string')
    }
  }
}
