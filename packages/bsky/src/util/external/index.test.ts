import { describe, expect, it } from 'vitest'
import { isExternalRecordUrlSafe } from './index.js'

const domains = ['good.com', 'good.net', '*.wild.com', 'good.org']
const safe = (url: string, list: readonly string[] = domains) =>
  isExternalRecordUrlSafe(url, list)

describe(isExternalRecordUrlSafe, () => {
  it('matches exact hosts, ignoring path, query, fragment and case', () => {
    expect(safe('https://good.com')).toBe(true)
    expect(safe('https://good.com/profile/x?y=1#z')).toBe(true)
    expect(safe('https://GOOD.Com/a')).toBe(true)
    expect(safe('https://good.net/x')).toBe(true)
    expect(safe('https://good.org/x')).toBe(true)
    expect(safe('https://good.com:443/x')).toBe(true)
  })

  it('matches wildcard children, including nested, but not the apex', () => {
    expect(safe('https://alice.wild.com/x')).toBe(true)
    expect(safe('https://a.b.wild.com')).toBe(true)
    expect(safe('https://ALICE.Wild.Com')).toBe(true)
    expect(safe('https://wild.com')).toBe(false)
  })

  it('does not match subdomains of plain entries', () => {
    expect(safe('https://www.good.com')).toBe(false)
    expect(safe('https://x.good.org')).toBe(false)
  })

  it('rejects lookalike suffixes and prefixes', () => {
    expect(safe('https://evilgood.com')).toBe(false)
    expect(safe('https://good.com.evil.com')).toBe(false)
    expect(safe('https://evilwild.com')).toBe(false)
    expect(safe('https://x.wild.com.evil.com')).toBe(false)
    expect(safe('https://good.com.')).toBe(false)
    expect(safe('https://a..wild.com')).toBe(false)
  })

  it('rejects non-HTTPS, non-default ports and credentials', () => {
    expect(safe('http://good.com')).toBe(false)
    expect(safe('ftp://good.com')).toBe(false)
    expect(safe('//good.com')).toBe(false)
    expect(safe('https://good.com:8443')).toBe(false)
    expect(safe('https://user@good.com')).toBe(false)
    expect(safe('https://user:pw@good.com')).toBe(false)
    expect(safe('https://@good.com')).toBe(false)
    expect(safe('https://evil.com@good.com')).toBe(false)
  })

  it('rejects backslashes, control characters and malformed URLs', () => {
    expect(safe('https://evil.com\\@good.com')).toBe(false)
    expect(safe('https://good.com\\x')).toBe(false)
    expect(safe('https://good.com/\nx')).toBe(false)
    expect(safe('https://good.com/a b')).toBe(false)
    expect(safe('')).toBe(false)
    expect(safe('not a url')).toBe(false)
    expect(safe('https://')).toBe(false)
  })

  it('trims and lowercases entries and ignores malformed ones', () => {
    expect(safe('https://good.com', [' Good.Com '])).toBe(true)
    expect(safe('https://a.wild.com', [' *.Wild.Com'])).toBe(true)
    const bad = [
      '',
      '  ',
      '*',
      '*.',
      '.',
      'https://good.com',
      'good.com/x',
      'good.com:443',
      'user@good.com',
      '**.good.com',
    ]
    expect(safe('https://good.com', bad)).toBe(false)
    expect(safe('https://a.good.com', bad)).toBe(false)
    expect(safe('https://good.com', [...bad, 'good.com'])).toBe(true)
  })

  it('matches nothing for an empty list', () => {
    expect(safe('https://good.com', [])).toBe(false)
  })
})
