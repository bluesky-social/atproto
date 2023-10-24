import { utf8Len } from '@atproto/common-web'

export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
export const LEADING_PUNCTUATION_REGEX = /^\p{P}+/gu
export const LEADING_HASH_REGEX = /^#/
export const LEADING_NUMBER_REGEX = /^\d/

/**
 * Matches an inline hashtag, and includes any trailing punctuation.
 */
export const HASHTAG_REGEX =
  /(?:^|\s)(#[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}]{1}[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]*)/gu

/**
 * Matches an inline hashtag, and includes any trailing punctuation.
 *
 * This trailing punctuation must be removed before use.
 */
export const HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX =
  /(?:^|\s)(#[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}]{1}[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]*\p{P}*)/gu

/**
 * Matches any characters NOT allowed in a hashtag
 */
export const HASHTAG_INVALID_CHARACTER_REGEX =
  /[^\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]/gu

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
