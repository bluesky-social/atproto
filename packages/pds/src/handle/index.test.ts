import { describe, expect, it } from 'vitest'
import { ensureHandleServiceConstraints } from './index.js'

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

  it('validates handle length', () => {
    const domains = [
      '.loooooooooooooooooong-pds-over18chars.mybsky.mydomain.com',
      '.test',
    ]
    const expectThrow = (handle: string, err: string) => {
      expect(() => ensureHandleServiceConstraints(handle, domains)).toThrow(err)
    }
    const expectNotThrow = (handle: string, _memo: string) => {
      expect(() =>
        ensureHandleServiceConstraints(handle, domains),
      ).not.toThrow()
    }
    expectThrow('usernamepartover18c.test', 'Handle too long')
    expectNotThrow(
      'u23456789012345678.test',
      'safe up to 18 chars in first segment of the handle',
    )
    expectThrow(
      'usernamepartover18c.loooooooooooooooooong-pds-over18chars.mybsky.mydomain.com',
      'Handle too long',
    )
    expectNotThrow(
      'u23456789012345678.loooooooooooooooooong-pds-over18chars.mybsky.mydomain.com',
      'safe long domain in the handle',
    )
  })
})
