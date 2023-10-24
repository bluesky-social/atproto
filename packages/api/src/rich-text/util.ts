const EMOJI = `\\p{Emoji_Presentation}\\p{Emoji_Modifier_Base}\\p{Extended_Pictographic}`

export const HASHTAG_REGEX = new RegExp(
  `(?:^|\\s)(#[\\p{L}${EMOJI}]{1}[\\p{L}${EMOJI}\\d_-]*)`,
  `giu`,
)
export const HASHTAG_REGEX_WITH_TRAILING_PUNCTUATION = new RegExp(
  `(?:^|\\s)(#[\\p{L}${EMOJI}]{1}[\\p{L}${EMOJI}\\d_-]*\\p{P}*)`,
  `giu`,
)
export const HASHTAG_INVALID_CHARACTER_REGEX = new RegExp(
  `[^\\p{L}${EMOJI}\\d_-]`,
  `giu`,
)
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
export const LEADING_PUNCTUATION_REGEX = /^\p{P}+/gu
export const LEADING_HASH_REGEX = /^#/
export const LEADING_NUMBER_REGEX = /^\d/
