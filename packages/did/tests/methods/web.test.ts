import { InvalidDidError } from '../../src/did-error.js'
import { Did } from '../../src/did.js'
import {
  asDidWeb,
  assertDidWeb,
  didWebToUrl,
  isDidWeb,
  urlToDidWeb,
} from '../../src/methods/web.js'

const VALID: [Did<'web'>, string][] = [
  ['did:web:example.com', 'https://example.com/'],
  ['did:web:sub.example.com', 'https://sub.example.com/'],
  ['did:web:example.com%3A8080', 'https://example.com:8080/'],
  [
    'did:web:example.com:path:to:resource',
    'https://example.com/path/to/resource',
  ],
  [
    'did:web:example.com%3A8080:path:to:resource',
    'https://example.com:8080/path/to/resource',
  ],
  [
    'did:web:xn--b48h.com%3A8080:path:to:resource',
    'https://🙃.com:8080/path/to/resource',
  ],
]

const INVALID: [value: unknown, message: string][] = [
  ['did:web:', 'DID method-specific id must not be empty'],
  ['did:web:foo@example.com', 'Disallowed character in DID at position 11'],
  ['did:web::example.com', 'did:web MSID must not start with a colon'],
  ['did:web:example.com:', 'DID cannot end with ":"'],
  ['did:web:exam%3Aple.com%3A8080', 'Invalid Web DID'],
  [3, 'DID must be a string'],
  [{ toString: () => 'did:web:foo.com' }, 'DID must be a string'],
  [[''], 'DID must be a string'],
  ['random-string', 'Invalid did:web prefix'],
  ['did web', 'Invalid did:web prefix'],
  ['lorem ipsum dolor sit', 'Invalid did:web prefix'],
]

describe('isDidWeb', () => {
  it('returns true for various valid dids', () => {
    for (const [did] of VALID) {
      expect(isDidWeb(did)).toBe(true)
    }
  })

  it('returns false for invalid dids', () => {
    for (const did of INVALID) {
      expect(isDidWeb(did)).toBe(false)
    }
  })
})

describe('assertDidWeb', () => {
  it('does not throw on valid dids', () => {
    for (const [did] of VALID) {
      expect(() => assertDidWeb(did)).not.toThrow()
    }
  })

  it('throws if called with non string argument', () => {
    for (const [val, message] of INVALID) {
      expect(() => assertDidWeb(val)).toThrow(
        new InvalidDidError(
          typeof val === 'string' ? val : typeof val,
          message,
        ),
      )
    }
  })
})

describe('didWebToUrl', () => {
  it('converts valid did:web to URL', () => {
    for (const [did, url] of VALID) {
      expect(didWebToUrl(did)).toStrictEqual(new URL(url))
    }
  })
})

describe('urlToDidWeb', () => {
  it('converts URL to valid did:web', () => {
    for (const [did, url] of VALID) {
      expect(urlToDidWeb(new URL(url))).toBe(did)
    }
  })
})

describe('asDidWeb', () => {
  it('returns the input for valid dids', () => {
    for (const [did] of VALID) {
      expect(asDidWeb(did)).toBe(did)
    }
  })

  it('throws if called with invalid dids', () => {
    for (const [val, message] of INVALID) {
      expect(() => asDidWeb(val)).toThrow(
        new InvalidDidError(
          typeof val === 'string' ? val : typeof val,
          message,
        ),
      )
    }
  })
})
