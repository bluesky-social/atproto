import {
  LanguageTag,
  fromBase64,
  graphemeLen,
  isLanguageString,
  parseLanguageString,
  toBase64,
  utf8Len,
} from '@atproto/lex-data'

/**
 * @deprecated Use {@link graphemeLen} from `@atproto/lex-data` instead.
 */
const graphemeLenLegacy = graphemeLen
export { graphemeLenLegacy as graphemeLen }

/**
 * @deprecated Use {@link utf8Len} from `@atproto/lex-data` instead.
 */
const utf8LenLegacy = utf8Len
export { utf8LenLegacy as utf8Len }

/**
 * @deprecated Use {@link LanguageTag} from `@atproto/lex-data` instead.
 */
type LanguageTagLegacy = LanguageTag
export type { LanguageTagLegacy as LanguageTag }

/**
 * @deprecated Use {@link parseLanguageString} from `@atproto/lex-data` instead.
 */
export const parseLanguageLegacy = parseLanguageString
export { parseLanguageLegacy as parseLanguage }

/**
 * @deprecated Use {@link isLanguageString} from `@atproto/lex-data` instead.
 */
export const validateLanguage = isLanguageString

/**
 * @deprecated Use {@link toBase64} from `@atproto/lex-data` instead.
 */
export const utf8ToB64Url = (utf8: string): string => {
  return toBase64(new TextEncoder().encode(utf8), 'base64url')
}

/**
 * @deprecated Use {@link fromBase64} from `@atproto/lex-data` instead.
 */
export const b64UrlToUtf8 = (b64: string): string => {
  return new TextDecoder().decode(fromBase64(b64, 'base64url'))
}
