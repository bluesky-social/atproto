import { countGraphemes } from 'unicode-segmenter/grapheme'

// @NOTE This file is not meant to be exported directly. Instead, we re-export
// public functions from ./utf8.ts. The reason for this separation is that this
// file allows to test both the NodeJS-optimized and ponyfill implementations.

// @TODO: Drop usage of "unicode-segmenter" package when Intl.Segmenter is
// widely supported.
// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
const segmenter =
  'Segmenter' in Intl && typeof Intl.Segmenter === 'function'
    ? /*#__PURE__*/ new Intl.Segmenter()
    : null

if (!segmenter) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Intl.Segmenter is not available in this environment. Falling back to "unicode-segmenter" package for grapheme segmentation.',
  )
}

export const graphemeLenSegmenter = segmenter
  ? (str: string): number => {
      let length = 0
      for (const _ of segmenter.segment(str)) length++
      return length
    }
  : null

export function graphemeLenInternal(str: string): number {
  return countGraphemes(str)
}

export const graphemeLen: (str: string) => number =
  graphemeLenSegmenter ?? graphemeLenInternal
