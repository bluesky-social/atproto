export const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
// inspired by https://gist.github.com/dperini/729294 (2018/09/12 version)
// gist credit: Diego Perini
export const URL_REGEX =
  /(?:^|\s|\()(?<uri>(?<protocol>https?:\/\/)?(?<domain>(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}\.(?:1\d\d|2[0-4]\d|25[0-4]|[1-9]\d?)|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]*)?[a-z0-9\u00a1-\uffff]\.)+(?<tld>[a-z\u00a1-\uffff]{2,})\.?)(?::\d{2,5})?(?:[/?#]\S*)?)/gim
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu

/**
 * `\ufe0f` emoji modifier
 * `\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2` zero-width spaces (likely incomplete)
 */
export const TAG_REGEX =
  // eslint-disable-next-line no-misleading-character-class
  /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu
