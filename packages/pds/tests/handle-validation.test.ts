import { isValidTld } from '@atproto/identifier'
import { ensureHandleServiceConstraints } from '../src/handle'
import { UnacceptableWordValidator } from '../src/content-reporter/validator'

describe('handle validation', () => {
  it('validates service constraints', () => {
    const domains = ['.bsky.app', '.test']
    const expectThrow = (handle: string, err: string) => {
      expect(() => ensureHandleServiceConstraints(handle, domains)).toThrow(err)
    }
    expectThrow('john.bsky.io', 'Invalid characters in handle')
    expectThrow('john.com', 'Invalid characters in handle')
    expectThrow('j.test', 'Handle too short')
    expectThrow('uk.test', 'Handle too short')
    expectThrow('john.test.bsky.app', 'Invalid characters in handle')
    expectThrow('about.test', 'Reserved handle')
    expectThrow('atp.test', 'Reserved handle')
    expectThrow('barackobama.test', 'Reserved handle')
  })

  it('handles bad tlds', () => {
    expect(isValidTld('atproto.local')).toBe(false)
    expect(isValidTld('atproto.arpa')).toBe(false)
    expect(isValidTld('atproto.invalid')).toBe(false)
    expect(isValidTld('atproto.localhost')).toBe(false)
    expect(isValidTld('atproto.onion')).toBe(false)
    expect(isValidTld('atproto.internal')).toBe(false)
  })

  const validator = new UnacceptableWordValidator(
    ['evil', 'mean', 'bad'],
    ['baddie'],
  )

  it('identifies offensive handles', () => {
    expect(validator.getMatches('evil.john.test')).toMatchObject(['evil'])
    expect(validator.getMatches('john.evil.test')).toMatchObject(['evil'])
    expect(validator.getMatches('john.test.evil')).toMatchObject(['evil'])
    expect(validator.getMatches('ev1l.test.john')).toMatchObject(['evil'])
    expect(validator.getMatches('ev-1l.test.john')).toMatchObject(['evil'])
    expect(validator.getMatches('ev-11.test.john')).toMatchObject(['evil'])
    expect(validator.getMatches('ev.-1.l-test.john')).toMatchObject(['evil'])
  })

  it('identifies non-offensive handles', () => {
    expect(validator.getMatches('john.test')).toHaveLength(0)
    expect(validator.getMatches('good.john.test')).toHaveLength(0)
    expect(validator.getMatches('john.baddie.test')).toHaveLength(0)
  })
})
