import {
  LanguageTag,
  graphemeLen,
  isLanguage,
  parseLanguage,
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
 * @deprecated Use {@link parseLanguage} from `@atproto/lex-data` instead.
 */
export const parseLanguageLegacy = parseLanguage
export { parseLanguageLegacy as parseLanguage }

/**
 * @deprecated Use {@link isLanguage} from `@atproto/lex-data` instead.
 */
export const validateLanguage = isLanguage
