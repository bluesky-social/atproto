import { asDid, isDid } from './did.js'

describe('isDid', () => {
  it('returns true for valid DIDs', () => {
    expect(isDid('did:example:123456')).toBe(true)
    expect(isDid('did:plc:abcdef')).toBe(true)
  })

  it('returns false for invalid DIDs', () => {
    expect(isDid('invalid-did')).toBe(false)
    expect(isDid('did:example')).toBe(false)
    expect(isDid(12345)).toBe(false)
    expect(isDid(null)).toBe(false)
    expect(isDid(undefined)).toBe(false)
  })
})

describe('asDid', () => {
  it('returns the input when it is a valid DID', () => {
    const did = 'did:example:123456'
    expect(asDid(did)).toBe(did)
  })

  it('throws an error when the input is not a valid DID', () => {
    expect(() => asDid('invalid-did')).toThrow()
    expect(() => asDid('did:example')).toThrow()
  })
})
