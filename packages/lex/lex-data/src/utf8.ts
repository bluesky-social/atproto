import { Base64Alphabet } from './uint8array.js'
import {
  utf8FromBase64Node,
  utf8FromBase64Ponyfill,
} from './utf8-from-base64.js'
import { graphemeLenNative, graphemeLenPonyfill } from './utf8-grapheme-len.js'
import { utf8LenCompute, utf8LenNode } from './utf8-len.js'
import { utf8ToBase64Node, utf8ToBase64Ponyfill } from './utf8-to-base64.js'

/**
 * Counts the number of grapheme clusters (user-perceived characters) in a string.
 *
 * Grapheme clusters represent what users typically think of as "characters",
 * handling complex cases like:
 * - Emoji with skin tones and ZWJ sequences (e.g., family emoji)
 * - Combined characters (e.g., 'e' + combining accent)
 * - Regional indicator pairs (flag emoji)
 *
 * Uses native {@link Intl.Segmenter} when available, falling back to a ponyfill.
 *
 * @param str - The string to measure
 * @returns The number of grapheme clusters
 *
 * @example
 * ```typescript
 * import { graphemeLen } from '@atproto/lex-data'
 *
 * graphemeLen('hello')        // 5
 * graphemeLen('cafe\u0301')   // 4 (cafe with combining accent)
 * graphemeLen('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}')  // 1 (family emoji)
 * ```
 */
export const graphemeLen: (str: string) => number =
  /* v8 ignore next -- @preserve */ graphemeLenNative ?? graphemeLenPonyfill

/* v8 ignore next -- @preserve */
if (graphemeLen === graphemeLenPonyfill) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Intl.Segmenter is not available in this environment. Falling back to ponyfill implementation.',
  )
}

/**
 * Calculates the UTF-8 byte length of a string.
 *
 * Returns the number of bytes the string would occupy when encoded as UTF-8.
 * This is important for Lexicon validation where schemas specify byte limits.
 *
 * Uses Node.js Buffer.byteLength when available for performance,
 * falling back to a computed implementation.
 *
 * @param str - The string to measure
 * @returns The UTF-8 byte length
 *
 * @example
 * ```typescript
 * import { utf8Len } from '@atproto/lex-data'
 *
 * utf8Len('hello')      // 5 (ASCII: 1 byte per char)
 * utf8Len('\u00e9')     // 2 (e with accent: 2 bytes)
 * utf8Len('\u{1F600}')  // 4 (emoji: 4 bytes)
 * utf8Len('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}')  // 25 (family emoji)
 * ```
 */
export const utf8Len: (string: string) => number =
  /* v8 ignore next -- @preserve */ utf8LenNode ?? utf8LenCompute

/**
 * Encodes a UTF-8 string to base64.
 *
 * First encodes the string as UTF-8 bytes, then encodes those bytes as base64.
 *
 * @param str - The string to encode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url')
 * @returns The base64-encoded string
 *
 * @example
 * ```typescript
 * import { utf8ToBase64 } from '@atproto/lex-data'
 *
 * utf8ToBase64('Hello')  // 'SGVsbG8='
 * ```
 */
export const utf8ToBase64: (str: string, alphabet?: Base64Alphabet) => string =
  /* v8 ignore next -- @preserve */ utf8ToBase64Node ?? utf8ToBase64Ponyfill

/**
 * Decodes a base64 string to UTF-8.
 *
 * Decodes the base64 to bytes, then interprets those bytes as UTF-8 text.
 *
 * @param b64 - The base64 string to decode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url')
 * @returns The decoded UTF-8 string
 *
 * @example
 * ```typescript
 * import { utf8FromBase64 } from '@atproto/lex-data'
 *
 * utf8FromBase64('SGVsbG8=')  // 'Hello'
 * ```
 */
export const utf8FromBase64: (
  b64: string,
  alphabet?: Base64Alphabet,
) => string =
  /* v8 ignore next -- @preserve */ utf8FromBase64Node ?? utf8FromBase64Ponyfill
