export const HASHTAG_REGEX =
  /(?:^|\s)(#[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}]{1}[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]*)/giu
export const HASHTAG_REGEX_WITH_TRAILING_PUNCTUATION =
  /(?:^|\s)(#[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}]{1}[\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]*\p{P}*)/giu
export const HASHTAG_INVALID_CHARACTER_REGEX =
  /[^\p{L}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}\d_-]/giu
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
export const LEADING_PUNCTUATION_REGEX = /^\p{P}+/gu
export const LEADING_HASH_REGEX = /^#/
export const LEADING_NUMBER_REGEX = /^\d/
