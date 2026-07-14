import { isAtprotoDidRefAbsolute } from '../src/atproto.js'
import { isDidRefRelative } from '../src/did-ref.js'

describe('isAtprotoDidRefAbsolute', () => {
  it('accepts well-formed absolute references', () => {
    expect(
      isAtprotoDidRefAbsolute('did:plc:l3rouwludahu3ui3bt66mfvj#atproto'),
    ).toBe(true)
    expect(isAtprotoDidRefAbsolute('did:web:example.com#service_id')).toBe(true)
    expect(isAtprotoDidRefAbsolute('did:web:example.com#atproto_label')).toBe(
      true,
    )
  })

  it('rejects bare DIDs', () => {
    expect(isAtprotoDidRefAbsolute('did:plc:l3rouwludahu3ui3bt66mfvj')).toBe(
      false,
    )
    expect(isAtprotoDidRefAbsolute('did:web:example.com')).toBe(false)
  })

  it('rejects relative references', () => {
    expect(isAtprotoDidRefAbsolute('#atproto')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isAtprotoDidRefAbsolute('')).toBe(false)
    expect(isAtprotoDidRefAbsolute('did:plc:l3rouwludahu3ui3bt66mfvj#')).toBe(
      false,
    )
    expect(
      isAtprotoDidRefAbsolute('did:plc:l3rouwludahu3ui3bt66mfvj##foo'),
    ).toBe(false)
    expect(
      isAtprotoDidRefAbsolute('did:plc:l3rouwludahu3ui3bt66mfvj#a#b'),
    ).toBe(false)
    expect(isAtprotoDidRefAbsolute('did:foo:bar#baz')).toBe(false)
    expect(isAtprotoDidRefAbsolute(null)).toBe(false)
    expect(isAtprotoDidRefAbsolute(123)).toBe(false)
  })
})

describe('isDidRefRelative', () => {
  it('accepts well-formed relative references', () => {
    expect(isDidRefRelative('#atproto')).toBe(true)
    expect(isDidRefRelative('#atproto_label')).toBe(true)
    expect(isDidRefRelative('#a')).toBe(true)
  })

  it('narrows on a specific id when supplied', () => {
    expect(isDidRefRelative('#atproto', 'atproto')).toBe(true)
    expect(isDidRefRelative('#atproto_label', 'atproto')).toBe(false)
  })

  it('rejects absolute references and bare strings', () => {
    expect(isDidRefRelative('did:plc:l3rouwludahu3ui3bt66mfvj#atproto')).toBe(
      false,
    )
    expect(isDidRefRelative('atproto')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isDidRefRelative('')).toBe(false)
    expect(isDidRefRelative('#')).toBe(false)
    expect(isDidRefRelative('#a#b')).toBe(false)
    expect(isDidRefRelative(null)).toBe(false)
    expect(isDidRefRelative(123)).toBe(false)
  })
})
