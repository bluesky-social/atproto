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

// Human readable constraints on NSID:
// - a valid domain in reversed notation. which means the same as a loose domain!
// - "nsid-ns" is a special situation, not allowed here
// - not clear if final "name" should be allowed in authority or not
// - TODO: current com.atproto.server.* means server.atproto.com is the
//   authority? hrm. hope we consider lookups by DNS not HTTP well-known,
//   otherwise could have some conflicts, and/or require a bunch of letsencrypt
//   certs for little reason
// - TODO: NSID docs allow a trailing hyphen in segment, domain RFC does not
// - TODO: what total length and segment lengths should be enforced? let's say
//   authority must be valid domain (so 253 max, 63 for paths), but name can be
//   up to 128 chars?
// - TODO: consider explicitly mapping hyphen to underscore when translating
//   NSID to identifiers in programming languages
export const lexVerifyNsid = (nsid: string): void => {
  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9.-]*$/.test(nsid)) {
    throw new Error(
      'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
    )
  }

  if (nsid.length > 253 + 1 + 128) {
    throw new Error('NSID is too long (382 chars max)')
  }
  const labels = nsid.split('.')
  if (labels.length < 3) {
    throw new Error('NSID needs at least three parts')
  }
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]
    if (l.length < 1) {
      throw new Error('NSID parts can not be empty')
    }
    if (l.length > 63 && i + 1 < labels.length) {
      throw new Error('NSID domain part too long (max 63 chars)')
    }
    if (l.length > 128 && i + 1 == labels.length) {
      throw new Error('NSID name part too long (max 127 chars)')
    }
    if (l.endsWith('-')) {
      throw new Error('NSID parts can not end with hyphen')
    }
    if (!/^[a-zA-Z]/.test(l)) {
      throw new Error('NSID parts must start with ASCII letter')
    }
  }
}
export const lexVerifyNsidRegex = (nsid: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (
    !/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\.[a-zA-Z]([a-zA-Z0-9-]{0,126}[a-zA-Z0-9])?)$/.test(
      nsid,
    )
  ) {
    throw new Error("NSID didn't validate via regex")
  }
  if (nsid.length > 253 + 1 + 128) {
    throw new Error('NSID is too long (382 chars max)')
  }
}
