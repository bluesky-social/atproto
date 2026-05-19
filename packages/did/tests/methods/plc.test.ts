import { InvalidDidError } from '../../src/did-error.js'
import { Did } from '../../src/did.js'
import { asDidPlc, assertDidPlc, isDidPlc } from '../../src/methods/plc.js'

const VALID: Did<'plc'>[] = [
  'did:plc:l3rouwludahu3ui3bt66mfvj',
  'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa',
  'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz',
]

const INVALID: [value: unknown, message: string][] = [
  ['did:plc:l3rouwludahu3ui3bt66mfv0', 'Invalid character at position 31'],
  ['did:plc:l3rouwludahu3ui3bt66mfv1', 'Invalid character at position 31'],
  ['did:plc:l3rouwludahu3ui3bt66mfv9', 'Invalid character at position 31'],
  ['did:plc:l3rouwludahu3ui3bt66mfv', 'did:plc must be 32 characters long'],
  ['did:plc:l3rouwludahu3ui3bt66mfvja', 'did:plc must be 32 characters long'],
  ['did:plc:example.com:', 'did:plc must be 32 characters long'],
  ['did:plc:exam%3Aple.com%3A8080', 'did:plc must be 32 characters long'],
  [3, 'DID must be a string'],
  [{ toString: () => 'did:plc:foo.com' }, 'DID must be a string'],
  [[''], 'DID must be a string'],
  ['random-string', 'Invalid did:plc prefix'],
  ['did plc', 'Invalid did:plc prefix'],
  ['lorem ipsum dolor sit', 'Invalid did:plc prefix'],
]

describe('isDidPlc', () => {
  it('returns true for various valid dids', () => {
    for (const did of VALID) {
      expect(isDidPlc(did)).toBe(true)
    }
  })

  it('returns false for invalid dids', () => {
    for (const [did] of INVALID) {
      expect(isDidPlc(did)).toBe(false)
    }
  })
})

describe('assertDidPlc', () => {
  it('does not throw on valid dids', () => {
    for (const did of VALID) {
      expect(() => assertDidPlc(did)).not.toThrow()
    }
  })

  it('throws if called with non string argument', () => {
    for (const [val, message] of INVALID) {
      expect(() => assertDidPlc(val)).toThrow(
        new InvalidDidError(
          typeof val === 'string' ? val : typeof val,
          message,
        ),
      )
    }
  })
})

describe('asDidPlc', () => {
  it('returns the input for valid dids', () => {
    for (const did of VALID) {
      expect(asDidPlc(did)).toBe(did)
    }
  })

  it('throws if called with invalid dids', () => {
    for (const [val] of INVALID) {
      expect(() => asDidPlc(val)).toThrow(InvalidDidError)
    }
  })
})
