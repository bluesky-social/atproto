import { Base64Alphabet } from './uint8array.js'
import {
  utf8FromBase64Node,
  utf8FromBase64Ponyfill,
} from './utf8-from-base64.js'
import { graphemeLenNative, graphemeLenPonyfill } from './utf8-grapheme-len.js'
import { utf8LenCompute, utf8LenNode } from './utf8-len.js'
import { utf8ToBase64Node, utf8ToBase64Ponyfill } from './utf8-to-base64.js'

export const graphemeLen: (str: string) => number =
  /* v8 ignore next -- @preserve */ graphemeLenNative ??
  /* v8 ignore next -- @preserve */ graphemeLenPonyfill

/* v8 ignore next -- @preserve */
if (graphemeLen === graphemeLenPonyfill) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Intl.Segmenter is not available in this environment. Falling back to ponyfill implementation.',
  )
}

export const utf8Len: (string: string) => number =
  /* v8 ignore next -- @preserve */ utf8LenNode ??
  /* v8 ignore next -- @preserve */ utf8LenCompute

export const utf8ToBase64: (str: string, alphabet?: Base64Alphabet) => string =
  /* v8 ignore next -- @preserve */ utf8ToBase64Node ??
  /* v8 ignore next -- @preserve */ utf8ToBase64Ponyfill

export const utf8FromBase64: (
  b64: string,
  alphabet?: Base64Alphabet,
) => string =
  /* v8 ignore next -- @preserve */ utf8FromBase64Node ??
  /* v8 ignore next -- @preserve */ utf8FromBase64Ponyfill
