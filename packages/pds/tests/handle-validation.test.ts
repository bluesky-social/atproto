import { isValidTld } from '@atproto/syntax'
import { ensureHandleServiceConstraints } from '../src/handle'

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
})
