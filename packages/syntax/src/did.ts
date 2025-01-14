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
//   - in current atproto, only allowing did:plc and did:web. But not *forcing* this at lexicon layer
//   - hard length limit of 8KBytes
//   - not going to validate "percent encoding" here
export const ensureValidDid = (did: string): void => {
  if (!did.startsWith('did:')) {
    throw new InvalidDidError('DID requires "did:" prefix')
  }

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._:%-]*$/.test(did)) {
    throw new InvalidDidError(
      'Disallowed characters in DID (ASCII letters, digits, and a couple other characters only)',
    )
  }

  const { length, 1: method } = did.split(':')
  if (length < 3) {
    throw new InvalidDidError(
      'DID requires prefix, method, and method-specific content',
    )
  }

  if (!/^[a-z]+$/.test(method)) {
    throw new InvalidDidError('DID method must be lower-case letters')
  }

  if (did.endsWith(':') || did.endsWith('%')) {
    throw new InvalidDidError('DID can not end with ":" or "%"')
  }

  if (did.length > 2 * 1024) {
    throw new InvalidDidError('DID is too long (2048 chars max)')
  }
}

export const ensureValidDidRegex = (did: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints
  if (!/^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/.test(did)) {
    throw new InvalidDidError("DID didn't validate via regex")
  }

  if (did.length > 2 * 1024) {
    throw new InvalidDidError('DID is too long (2048 chars max)')
  }
}

export class InvalidDidError extends Error {}
