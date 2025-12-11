/**
 * @see {@link https://www.w3.org/TR/did-1.0/#dfn-did-fragments}
 * @see {@link https://datatracker.ietf.org/doc/html/rfc3986#section-3.5}
 */
export function isFragment(
  value: string,
  startIdx = 0,
  endIdx = value.length,
): boolean {
  let charCode: number
  for (let i = startIdx; i < endIdx; i++) {
    charCode = value.charCodeAt(i)

    // fragment    = *( pchar / "/" / "?" )
    // pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
    // unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
    // pct-encoded = "%" HEXDIG HEXDIG
    // sub-delims  = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
    if (
      (charCode >= 65 /* A */ && charCode <= 90) /* Z */ ||
      (charCode >= 97 /* a */ && charCode <= 122) /* z */ ||
      (charCode >= 48 /* 0 */ && charCode <= 57) /* 9 */ ||
      charCode === 45 /* "-" */ ||
      charCode === 46 /* "." */ ||
      charCode === 95 /* "_" */ ||
      charCode === 126 /* "~" */
    ) {
      // unreserved
    } else if (
      charCode === 33 /* "!" */ ||
      charCode === 36 /* "$" */ ||
      charCode === 38 /* "&" */ ||
      charCode === 39 /* "'" */ ||
      charCode === 40 /* "(" */ ||
      charCode === 41 /* ")" */ ||
      charCode === 42 /* "*" */ ||
      charCode === 43 /* "+" */ ||
      charCode === 44 /* "," */ ||
      charCode === 59 /* ";" */ ||
      charCode === 61 /* "=" */
    ) {
      // sub-delims
    } else if (charCode === 58 /* ":" */ || charCode === 64 /* "@" */) {
      // pchar extra
    } else if (charCode === 47 /* "/" */ || charCode === 63 /* "?" */) {
      // fragment extra
    } else if (charCode === 37 /* "%" */) {
      // pct-enc
      if (i + 2 >= endIdx) return false
      if (!isHexDigit(value.charCodeAt(i + 1))) return false
      if (!isHexDigit(value.charCodeAt(i + 2))) return false
      i += 2
    } else {
      return false
    }
  }

  return true
}

export function isHexDigit(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 70) || // A-F
    (code >= 97 && code <= 102) // a-f
  )
}

export const canParse =
  URL.canParse?.bind(URL) ??
  ((url, base) => {
    try {
      new URL(url, base)
      return true
    } catch {
      return false
    }
  })
