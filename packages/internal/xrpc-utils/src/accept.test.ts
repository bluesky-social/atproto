import { describe, expect, test } from 'vitest'
import { buildProxiedContentEncoding } from './accept.js'

describe(buildProxiedContentEncoding, () => {
  test.each(
    [
      ',gzip',
      'gzip,',
      ',gzip,',
      'gzip,,',
      ' , gzip , \t,',
      ['', 'gzip,', ' \t'],
    ].map((header) => ({ header })),
  )('ignores empty list elements in $header', ({ header }) => {
    expect(buildProxiedContentEncoding(header, true)).toBe(
      'gzip;q=1,identity;q=0.1',
    )
  })

  test.each(
    [undefined, '', ' \t', ',', ', \t,', ['', ' \t,']].map((header) => ({
      header,
    })),
  )('falls back to identity for $header', ({ header }) => {
    expect(buildProxiedContentEncoding(header, true)).toBe('identity;q=0.1')
  })

  test('preserves encoding exclusions around empty list elements', () => {
    expect(
      buildProxiedContentEncoding(',gzip,,deflate;q=0,identity;q=0,', true),
    ).toBe('gzip;q=1,*;q=0')
    expect(() => buildProxiedContentEncoding(',*;q=0,', true)).toThrow(
      'this service does not support any of the requested encodings',
    )
  })

  test.each([';q=1', 'gzip;q=2', 'gzip;foo=1'])(
    'rejects malformed nonempty entries in %j',
    (entry) => {
      expect(() => buildProxiedContentEncoding(`,${entry},`, true)).toThrow(
        `Invalid accept-encoding: "${entry}"`,
      )
    },
  )
})
