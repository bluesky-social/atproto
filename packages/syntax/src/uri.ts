export type UriString = `${string}:${string}`

const URI_MAX_BYTE_LENGTH = 8192
const URI_REGEX = /^\w+:(?:\/\/)?[^\s/][^\s]*$/

export function isValidUri<I extends string>(input: I): input is I & UriString {
  return URI_REGEX.test(input) && utf8MaxLengthCheck(input, URI_MAX_BYTE_LENGTH)
}

function utf8MaxLengthCheck(string: string, maxLength: number): boolean {
  // Optimization: we can avoid computing the UTF-8 length if the maximum
  // possible length, in bytes, of the input JS string is smaller than the
  // maxLength (in UTF-8 string bytes).
  if (string.length * 3 <= maxLength) {
    // Input string so small it can't possibly exceed maxLength
    return true
  }
  if (string.length > maxLength) {
    // Input string too large in UTF-16 code units to be within maxLength
    return false
  }

  // The base length is the string length (all ASCII)
  let len = string.length
  let code: number

  // The loop calculates the number of additional bytes needed for
  // non-ASCII characters
  for (let i = 0; i < string.length; i += 1) {
    code = string.charCodeAt(i)

    if (code <= 0x7f) {
      // ASCII, 1 byte
    } else if (code <= 0x7ff) {
      // 2 bytes char
      len += 1

      if (len > maxLength) return false // No need to continue counting
    } else {
      // 3 bytes char
      len += 2

      if (len > maxLength) return false // No need to continue counting

      // If the current char is a high surrogate, and the next char is a low
      // surrogate, skip the next char as the total is a 4 bytes char
      // (represented as a surrogate pair in UTF-16) and was already accounted
      // for in the base length.
      if (code >= 0xd800 && code <= 0xdbff) {
        code = string.charCodeAt(i + 1)
        if (code >= 0xdc00 && code <= 0xdfff) {
          i++
        }
      }
    }
  }

  return len <= maxLength
}
