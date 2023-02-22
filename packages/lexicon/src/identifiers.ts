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
//  - must be a possible domain name
//    - RFC-1035 is commonly referenced, but has been updated. eg, RFC-3696,
//      section 2. and RFC-3986, section 3. can now have leading numbers (eg,
//      4chan.org)
//    - "labels" (sub-names) are made of ASCII letters, digits, hyphens
//    - can not start or end with a hyphen
//    - TLD (last component) should not start with a digit
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
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]
    if (l.length < 1) {
      throw new Error('Handle parts can not be empty')
    }
    if (l.length > 63) {
      throw new Error('Handle part too long (max 63 chars)')
    }
    if (l.endsWith('-') || l.startsWith('-')) {
      throw new Error('Handle parts can not start or end with hyphens')
    }
    if (i + 1 == labels.length && !/^[a-zA-Z]/.test(l)) {
      throw new Error(
        'Handle final component (TLD) must start with ASCII letter',
      )
    }
  }
}

export const lexVerifyHandleRegex = (handle: string): void => {
  // simple regex to enforce most constraints via just regex and length
  // hand wrote this regex based on above constraints
  if (
    !/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(
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
// - TODO: confirm whether we want to restrict to no leading numbers. consider
//   programming language variable name restrictions. But what about 'org.4chan.*'...
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

// Human-readable constraints:
//   - valid W3C DID (https://www.w3.org/TR/did-core/#did-syntax)
//      - entire URI is ASCII: [a-zA-Z0-9._:%-]
//      - always starts "did:" (lower-case)
//      - method name is one or more lower-case letters, followed by ":"
//      - remaining identifier can have any of the above chars, but can not end in ":"
//      - it seems that a bunch of ":" can be included, and don't need spaces between
//      - "%" is used only for "percent encoding" and must be followed by two hex characters (and thus can't end in "%")
//      - query ("?") and fragment ("#") stuff is defined for "DID URIs", but not as part of identifier itself
//      - "The current specification does not take a position on the maximum length of a DID"
//   - in current atproto, only allowing did:plc and did:web. But not *forcing* this at lexico layer
//   - hard length limit of 8KBytes
//   - not going to validate "percent encoding" here
//   - TODO: shorter hard limit?
export const lexVerifyDid = (did: string): void => {
  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._:%-]*$/.test(did)) {
    throw new Error(
      'Disallowed characters in DID (ASCII letters, digits, and a couple other characters only)',
    )
  }

  const parts = did.split(':')
  if (parts.length < 3) {
    throw new Error('DID requires prefix, method, and method-specific content')
  }

  if (parts[0] != 'did') {
    throw new Error('DID requires "did:" prefix')
  }

  if (!/^[a-z]+$/.test(parts[1])) {
    throw new Error('DID method must be lower-case letters')
  }

  if (did.endsWith(':') || did.endsWith('%')) {
    throw new Error('DID can not end with ":" or "%"')
  }

  if (did.length > 8 * 1024) {
    throw new Error('DID is far too long')
  }
}

export const lexVerifyDidRegex = (did: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (!/^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/.test(did)) {
    throw new Error("DID didn't validate via regex")
  }

  if (did.length > 8 * 1024) {
    throw new Error('DID is far too long')
  }
}

// Human-readable constraints on ATURI:
//   - following regular URLs, a 8KByte hard total length limit
//   - follows ATURI docs on website
//      - all ASCII characters, no whitespace. non-ASCII could be URL-encoded
//      - starts "at://"
//      - "authority" is a valid DID or a valid handle
//      - optionally, follow "authority" with "/" and valid NSID as start of path
//      - optionally, if NSID given, follow that with "/" and rkey
//      - rkey path component can include URL-encoded ("percent encoded"), or:
//          ALPHA / DIGIT / "-" / "." / "_" / "~" / ":" / "@" / "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
//          [a-zA-Z0-9._~:@!$&'\(\)*+,;=-]
//      - rkey must have at least one char
//      - regardless of path component, a fragment can follow  as "#" and then a JSON pointer (RFC-6901)
//  - TODO: should we really disallow trailing slash after authority if no
//    path? and after collection if no rkey
//  - TODO: rkey seems very flexible! do we really want that?
//  - TODO: propose that fragment JSON pointer must be one or more chars
//  - TODO: JSON pointer (in URI fragment) is super flexible, allows Unicode (not UTF-8!), and basically any character is allowed, including whitespace and control characters. Think we should narrow that down. Do probably need things like square brackets and quotes? hrm
//  - TODO: feels like we might want to be more flexible about path section to leave ourselves room in the future

export const lexVerifyAtUri = (uri: string): void => {
  // JSON pointer is pretty different from rest of URI, so split that out first
  const uriParts = uri.split('#')
  if (uriParts.length > 2) {
    throw new Error('ATURI can have at most one "#", separating fragment out')
  }
  const fragmentPart = uriParts[1] || null
  uri = uriParts[0]

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._~:@!$&')(*+,;=%/-]*$/.test(uri)) {
    throw new Error('Disallowed characters in ATURI (ASCII)')
  }

  const parts = uri.split('/')
  if (parts.length >= 3 && (parts[0] != 'at:' || parts[1].length != 0)) {
    throw new Error('ATURI must start with "at://"')
  }
  if (parts.length < 3) {
    throw new Error('ATURI requires at least method and authority sections')
  }

  try {
    lexVerifyHandle(parts[2])
  } catch {
    try {
      lexVerifyDid(parts[2])
    } catch {
      throw new Error('ATURI authority must be a valid handle or DID')
    }
  }

  if (parts.length >= 4) {
    if (parts[3].length == 0) {
      throw new Error(
        'ATURI can not have a slash after authority without a path segment',
      )
    }
    try {
      lexVerifyNsid(parts[3])
    } catch {
      throw new Error(
        'ATURI requires first path segment (if supplied) to be valid NSID',
      )
    }
  }

  if (parts.length >= 5) {
    if (parts[4].length == 0) {
      throw new Error(
        'ATURI can not have a slash after collection, unless record key is provided',
      )
    }
    // would validate rkey here, but there are basically no constraints!
  }

  if (parts.length >= 6) {
    throw new Error(
      'ATURI path can have at most two parts, and no trailing slash',
    )
  }

  if (uriParts.length >= 2 && fragmentPart == null) {
    throw new Error('ATURI fragment must be non-empty and start with slash')
  }

  if (fragmentPart != null) {
    if (fragmentPart.length == 0 || fragmentPart[0] != '/') {
      throw new Error('ATURI fragment must be non-empty and start with slash')
    }
    // NOTE: enforcing *some* checks here for sanity. Eg, at least no whitespace
    if (!/^\/[a-zA-Z0-9._~:@!$&')(*+,;=%[\]/-]*$/.test(fragmentPart)) {
      throw new Error('Disallowed characters in ATURI fragment (ASCII)')
    }
  }

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }
}

export const lexVerifyAtUriRegex = (uri: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints. whew!
  const aturiRegex =
    /^at:\/\/(?<authority>[a-zA-Z0-9._:%-]+)(\/(?<collection>[a-zA-Z0-9-.]+)(\/(?<rkey>[a-zA-Z0-9._~:@!$&%')(*+,;=-]+))?)?(#(?<fragment>\/[a-zA-Z0-9._~:@!$&%')(*+,;=\-[\]/\\]*))?$/
  const rm = uri.match(aturiRegex)
  if (!rm || !rm.groups) {
    throw new Error("ATURI didn't validate via regex")
  }
  const groups = rm.groups

  try {
    lexVerifyHandleRegex(groups.authority)
  } catch {
    try {
      lexVerifyDidRegex(groups.authority)
    } catch {
      throw new Error('ATURI authority must be a valid handle or DID')
    }
  }

  if (groups.collection) {
    try {
      lexVerifyNsidRegex(groups.collection)
    } catch {
      throw new Error('ATURI collection path segment must be a valid NSID')
    }
  }

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }
}
