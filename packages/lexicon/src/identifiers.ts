// These are relatively permissive validators for identifier strings. The idea
// is to have simple implementations here, and test coverage, that would be
// enforced while doing Lexicon-level validation. These are redundant with
// existing packages like 'handle', 'nsid', and 'uri'... but those packages
// might be enforcing additional validation or constratins beyond those here.
//
// For use in consistent cross-language / cross-implementation validation, I
// think it is beneficial to have these be simple and not rely on external
// libraries.

// Handle constraints, in English:
//  - must be a possible domain name per RFC-1035
//    - "labels" (sub-names) are made of ASCII letters, digits, hyphens
//    - must start with a letter
//    - can't end with a hyphen (can end with digit)
//    - must be between 2 and 63 characters (not including any periods)
//    - overall length can't be more than 253 characters
//    - separated by (ASCII) periods; does not start or end with period
//    - case insensitive
//    - domains (handles) are equal if they are the same lower-case
//    - punycode allowed for internationalization
//  - no whitespace, null bytes, joining chars, etc
//  - does not validate whether domain or TLD exists, or is a reserved or
//    special TLD (eg, .onion or .local)
//  - does not validate punycode

// This longer handle verifier gives understandable errors
export const lexVerifyHandle = (handle: string): void => {
  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]*$/.test(handle)) {
    throw new Error(
      'Disallowed characters in handle (ASCII letters, digits, dashes, periods only)',
    )
  }

  if (handle.length > 253) {
    throw new Error('Handle is too long (253 chars max)')
  }
  const labels = handle.split('.')
  if (labels.length < 2) {
    throw new Error('Handle domain needs at least two parts')
  }
  labels.forEach((l) => {
    if (l.length < 1) {
      throw new Error('Handle parts can not be empty')
    }
    if (l.length > 63) {
      throw new Error('Handle part too long (max 63 chars)')
    }
    if (l.endsWith('-')) {
      throw new Error('Handle parts can not end with hyphen')
    }
    if (!/^[a-zA-Z]/.test(l)) {
      throw new Error('Handle parts must start with ASCII letter')
    }
  })
}

export const lexVerifyHandleRegex = (handle: string): void => {
  // simple regex to enforce most constraints via just regex and length
  // hand wrote this regex based on above constraints
  if (
    !/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
      handle,
    )
  ) {
    throw new Error("Handle didn't validate via regex")
  }
  if (handle.length > 253) {
    throw new Error('Handle is too long (253 chars max)')
  }
}
