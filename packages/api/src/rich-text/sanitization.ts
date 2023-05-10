import { RichText } from './rich-text'
import { UnicodeString } from './unicode'

const EXCESS_SPACE_RE = /[\r\n]([\u00AD\u2060\u200D\u200C\u200B\s]*[\r\n]){2,}/gs

/**
 * Sanitizes the given rich text by removing excess spaces or newlines.
 * @param richText The rich text to sanitize.
 * @param opts Options for sanitization.
 *              - cleanNewlines: Whether to clean excess newlines.
 * @returns The sanitized rich text.
 */
export function sanitizeRichText(
  richText: RichText,
  opts: { cleanNewlines?: boolean } = {},
): RichText {
  if (opts.cleanNewlines ?? false) {
    richText = sanitize(richText, EXCESS_SPACE_RE, '\n\n')
  }
  return richText
}

/**
 * Performs the actual sanitization of the rich text by removing the matched pattern and inserting the replacement.
 * @param richText The rich text to sanitize.
 * @param targetRegexp The regular expression pattern to match.
 * @param replacementString The replacement string to insert.
 * @returns The sanitized rich text. Function was originally called "clean".
 */

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
