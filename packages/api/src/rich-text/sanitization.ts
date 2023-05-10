import { RichText } from './rich-text'
import { UnicodeString } from './unicode'

const EXCESS_SPACE_RE = /[\r\n]([\u00AD\u2060\u200D\u200C\u200B\s]*[\r\n]){2,}/gs

export function sanitizeRichText(
  richText: RichText,
  opts: { cleanNewlines?: boolean } = {},
): RichText {
  if (opts.cleanNewlines ?? false) {
    richText = sanitize(richText, EXCESS_SPACE_RE, '\n\n')
  }
  return richText
}

function sanitize(
  richText: RichText,
  targetRegexp: RegExp,
  replacementString: string,
): RichText {
  richText = richText.clone()

  let match: RegExpExecArray | null
  while ((match = targetRegexp.exec(richText.unicodeText.utf16))) {
    const oldText = richText.unicodeText
    const removeStartIndex = richText.unicodeText.utf16IndexToUtf8Index(
      match.index,
    )
    const removeEndIndex =
      removeStartIndex + new UnicodeString(match[0]).length
    richText.delete(removeStartIndex, removeEndIndex)
    if (richText.unicodeText.utf16 === oldText.utf16) {
      break // sanity check
    }
    richText.insert(removeStartIndex, replacementString)
  }

  return richText
}
