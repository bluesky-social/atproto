import { RichText } from './rich-text'
import { UnicodeString } from './unicode'

// this regex is intentionally matching on the zero-with-separator codepoint
// eslint-disable-next-line no-misleading-character-class
const EXCESS_SPACE_RE = /[\r\n]([\u00AD\u2060\u200D\u200C\u200B\s]*[\r\n]){2,}/
const REPLACEMENT_STR = '\n\n'

export function sanitizeRichText(
  richText: RichText,
  opts: { cleanNewlines?: boolean },
) {
  if (opts.cleanNewlines) {
    richText = clean(richText, EXCESS_SPACE_RE, REPLACEMENT_STR)
  }
  return richText
}

function clean(
  richText: RichText,
  targetRegexp: RegExp,
  replacementString: string,
): RichText {
  richText = richText.clone()

  let match = richText.unicodeText.utf16.match(targetRegexp)
  while (match && typeof match.index !== 'undefined') {
    const oldText = richText.unicodeText
    const removeStartIndex = richText.unicodeText.utf16IndexToUtf8Index(
      match.index,
    )
    const removeEndIndex = removeStartIndex + new UnicodeString(match[0]).length
    richText.delete(removeStartIndex, removeEndIndex)
    if (richText.unicodeText.utf16 === oldText.utf16) {
      break // sanity check
    }
    richText.insert(removeStartIndex, replacementString)
    match = richText.unicodeText.utf16.match(targetRegexp)
  }

  return richText
}
