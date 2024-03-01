export const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
export const URL_REGEX =
  /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim
export const TAG_REGEX =
  /(^|\s)#((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D]*[^\d\s\u00AD\u2060\u200A\u200B\u200C\u200D]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D]*)?/g
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
