import { utf8Len } from '@atproto/common-web'

export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
export const LEADING_PUNCTUATION_REGEX = /^\p{P}+/gu
export const LEADING_HASH_REGEX = /^#/
export const LEADING_NUMBER_REGEX = /^\d/

/**
 * Matches an inline hashtag, and includes any trailing punctuation.
 */
export const HASHTAG_REGEX =
  /(?:^|\s)(#(?!#|\d|\*)[\p{L}\p{Emoji}\p{Emoji_Component}]{1}(?![\p{L}\p{Emoji}\p{Emoji_Component}\d_-]*[*#][\p{L}\p{Emoji}\p{Emoji_Component}\d_-])[\p{L}\p{Emoji}\p{Emoji_Component}\d_-]*)/gu

/***************************
 * NOTE: keep these two in sync. They're exactly the same, except for matching punctuation characters at the end.
 **************************/

/**
 * Matches an inline hashtag, and includes any trailing punctuation.
 *
 * This trailing punctuation must be removed before use.
 */
export const HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX =
  /(?:^|\s)(#(?!#|\d|\*)[\p{L}\p{Emoji}\p{Emoji_Component}]{1}(?![\p{L}\p{Emoji}\p{Emoji_Component}\d_-]*[*#][\p{L}\p{Emoji}\p{Emoji_Component}\d_-])[\p{L}\p{Emoji}\p{Emoji_Component}\d_-]*[\p{P}*#]*)/gu

/**
 * Matches any characters NOT allowed in a hashtag.
 */
export const HASHTAG_INVALID_CHARACTER_REGEX =
  // Both Emoji and Emoji_Component match * and #, so those are separately
  // matched.
  /(?:[^\p{L}\p{Emoji}\p{Emoji_Component}\d_-]|[*#])/gu

/**
 * Sanitize a hashtag string.
 *
 *   - removes leading #
 *   - removes leading numbers
 *   - removes leading punctuation
 *   - removes invalid characters
 *   - removes trailing punctuation
 */
export function sanitizeHashtag(hashtag: string) {
  // TODO may need to limit utf8 bytes length here too
  return hashtag
    .replace(LEADING_HASH_REGEX, '')
    .replace(LEADING_NUMBER_REGEX, '')
    .replace(LEADING_PUNCTUATION_REGEX, '')
    .replace(HASHTAG_INVALID_CHARACTER_REGEX, '')
    .replace(TRAILING_PUNCTUATION_REGEX, '')
    .slice(0, 64)
}

/**
 * Validate a hashtag string.
 */
export function validateHashtag(hashtag: string): boolean {
  const trimmed = hashtag.replace(LEADING_HASH_REGEX, '').trim()
  if (trimmed.length > 64) return false
  if (utf8Len(trimmed) > 640) return false
  return trimmed === sanitizeHashtag(hashtag)
}
