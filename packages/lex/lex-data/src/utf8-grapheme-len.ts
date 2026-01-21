import { countGraphemes } from 'unicode-segmenter/grapheme'

// @TODO: Drop usage of "unicode-segmenter" package when Intl.Segmenter is
// widely supported.
// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
const segmenter =
  'Segmenter' in Intl && typeof Intl.Segmenter === 'function'
    ? /*#__PURE__*/ new Intl.Segmenter()
    : /* v8 ignore next -- @preserve */ null

export const graphemeLenNative = segmenter
  ? function graphemeLenNative(str: string): number {
      let length = 0
      for (const _ of segmenter.segment(str)) length++
      return length
    }
  : /* v8 ignore next -- @preserve */ null

export function graphemeLenPonyfill(str: string): number {
  return countGraphemes(str)
}
