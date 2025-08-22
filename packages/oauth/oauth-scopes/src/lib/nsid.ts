export type Nsid = `${string}.${string}.${string}`
export const isNsid = (v: unknown): v is Nsid =>
  typeof v === 'string' && isValidNsid(v)

// @NOTE the code below is a copy-paste from @atproto/syntax. The reason for
// this is that this package (as well as @atproto/syntax) gets compiled as an
// commonjs module, preventing tree-shaking of un-necessary @atproto/syntax code
// when bundled by vite. This can be replaced with an import once all packages
// use esm modules.

function isValidNsid(value: string): boolean {
  const { length } = value
  if (length > 253 + 1 + 63) {
    // NSID is too long (317 chars max)
    return false
  }

  let partCount = 1
  let partStart = 0
  let partHasLeadingDigit = false
  let partHasHyphen = false

  let charCode: number
  for (let i = 0; i < length; i++) {
    charCode = value.charCodeAt(i)

    // Hot path: check frequent chars first
    if (
      (charCode >= 97 && charCode <= 122) /* a-z */ ||
      (charCode >= 65 && charCode <= 90) /* A-Z */
    ) {
      // All good
    } else if (charCode >= 48 && charCode <= 57 /* 0-9 */) {
      if (i === 0) {
        // NSID first part may not start with a digit
        return false
      }

      // All good

      if (i === partStart) {
        partHasLeadingDigit = true
      }
    } else if (charCode === 45 /* - */) {
      if (i === partStart) {
        // NSID part can not start with hyphen
        return false
      }
      if (i === length - 1 || value.charCodeAt(i + 1) === 46 /* . */) {
        // NSID part can not end with hyphen
        return false
      }

      // All good

      partHasHyphen = true
    } else if (charCode === 46 /* . */) {
      // Check prev part size
      if (i === partStart) {
        // NSID parts can not be empty
        return false
      }
      if (i - partStart > 63) {
        // NSID part too long (max 63 chars)
        return false
      }

      // All good

      partCount++
      partStart = i + 1
      partHasHyphen = false
      partHasLeadingDigit = false
    } else {
      // Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)
      return false
    }
  }

  // Check last part size
  if (length === partStart) {
    // NSID parts can not be empty
    return false
  }
  if (length - partStart > 63) {
    // NSID part too long (max 63 chars)
    return false
  }

  // Check last part chars
  if (partHasHyphen || partHasLeadingDigit) {
    // NSID name part must be only letters and digits (and no leading digit)
    return false
  }

  // Check part count
  if (partCount < 3) {
    // NSID needs at least three parts
    return false
  }

  return true
}
