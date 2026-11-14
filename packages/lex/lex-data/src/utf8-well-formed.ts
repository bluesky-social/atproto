// @NOTE This file is not meant to be exported directly. Instead, we re-export
// public functions from ./utf8.ts. The reason for this separation is that this
// file allows to test both the RegExp and ponyfill implementations.

// Unicode property escapes (ES2018) are a SyntaxError where unsupported, which
// a RegExp literal would throw as soon as this module is parsed. With the `u`
// flag, a surrogate pair is matched as one code point, so only lone surrogates
// match.
const loneSurrogate: RegExp | null = /*#__PURE__*/ (() => {
  try {
    return new RegExp('\\p{Cs}', 'u')
  } catch {
    /* v8 ignore next -- @preserve */
    return null
  }
})()

export const isWellFormedRegExp: ((str: string) => boolean) | null =
  loneSurrogate
    ? function isWellFormedRegExp(str) {
        return !loneSurrogate.test(str)
      }
    : /* v8 ignore next -- @preserve */ null

export function isWellFormedPonyfill(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0xd800 || code > 0xdfff) continue

    // A high surrogate followed by a low surrogate is a valid pair
    if (code <= 0xdbff) {
      const next = str.charCodeAt(i + 1) // NaN past the end
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++
        continue
      }
    }

    return false
  }

  return true
}
