import { graphemeLenNative, graphemeLenPonyfill } from './utf8-grapheme-len.js'
import { utf8LenCompute, utf8LenNode } from './utf8-len.js'

export const graphemeLen: (str: string) => number =
  graphemeLenNative ?? graphemeLenPonyfill

if (graphemeLen === graphemeLenPonyfill) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Intl.Segmenter is not available in this environment. Falling back to ponyfill implementation.',
  )
}

export const utf8Len: (string: string) => number = utf8LenNode ?? utf8LenCompute
