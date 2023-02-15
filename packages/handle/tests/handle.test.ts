import {
  ensureValid,
  ensureServiceConstraints,
  normalizeAndEnsureValid,
} from '../src'

describe('handle validation', () => {
  const domains = ['.bsky.app', '.test']

  it('allows valid handles', () => {
    ensureValid('john.test')
    ensureValid('jan.test')
    ensureValid('a234567890123456789.test')
    ensureValid('john2.test')
    ensureValid('john-john.test')
    ensureValid('john.bsky.app')
    ensureValid('0john.test')
    ensureValid('12345.test')
    ensureValid('this.has.many.sub.domains.test')
  })

  it('allows handles that pass service constraints', () => {
    ensureServiceConstraints('john.test', domains)
    ensureServiceConstraints('jan.test', domains)
    ensureServiceConstraints('a234567890123456789.test', domains)
    ensureServiceConstraints('john2.test', domains)
    ensureServiceConstraints('john-john.test', domains)
    ensureServiceConstraints('john.bsky.app', domains)
    ensureServiceConstraints('0john.test', domains)
    ensureServiceConstraints('12345.test', domains)
  })

  it('allows punycode handles', () => {
    ensureValid('xn--ls8h.test') // 💩.test
    ensureValid('xn--bcher-kva.tld') // bücher.tld
  })

  it('throws on invalid handles', () => {
    const expectThrow = (handle: string, err: string) => {
      expect(() => ensureValid(handle)).toThrow(err)
    }

    expectThrow(
      'did:john.test',
      'Cannot register a handle that starts with `did:`',
    )
    expectThrow('jaymome-johnber123456.test', 'Handle too long')
    expectThrow('jay.mome-johnber1234567890.subdomain.test', 'Handle too long')
    expectThrow(
      'short.loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong.test',
      'Handle too long',
    )
    expectThrow(
      'short.short.short.short.short.short.short.test',
      'Handle too long',
    )
    expectThrow('john..test', 'Invalid characters in handle')
    expectThrow('jo_hn.test', 'Invalid characters in handle')
    expectThrow('-john.test', 'Invalid characters in handle')
    expectThrow('john-.test', 'Invalid characters in handle')
    expectThrow('.john.test', 'Invalid characters in handle')
    expectThrow('jo!hn.test', 'Invalid characters in handle')
    expectThrow('jo%hn.test', 'Invalid characters in handle')
    expectThrow('jo&hn.test', 'Invalid characters in handle')
    expectThrow('jo@hn.test', 'Invalid characters in handle')
    expectThrow('jo*hn.test', 'Invalid characters in handle')
    expectThrow('jo|hn.test', 'Invalid characters in handle')
    expectThrow('jo:hn.test', 'Invalid characters in handle')
    expectThrow('jo/hn.test', 'Invalid characters in handle')
    expectThrow('john💩.test', 'Invalid characters in handle')
    expectThrow('bücher.test', 'Invalid characters in handle')
  })

  it('throw on handles that violate service constraints', () => {
    const expectThrow = (handle: string, err: string) => {
      expect(() => ensureServiceConstraints(handle, domains)).toThrow(err)
    }

    expectThrow('john.bsky.io', 'Not a supported handle domain')
    expectThrow('john.com', 'Not a supported handle domain')
    expectThrow('j.test', 'Handle too short')
    expectThrow('uk.test', 'Handle too short')
    expectThrow('john.test.bsky.app', 'Invalid characters in handle')
    expectThrow('about.test', 'Reserved handle')
    expectThrow('atp.test', 'Reserved handle')
    expectThrow('barackobama.test', 'Reserved handle')
  })

  it('normalizes handles', () => {
    const normalized = normalizeAndEnsureValid('JoHn.TeST')
    expect(normalized).toBe('john.test')
  })

  it('throws on invalid normalized handles', () => {
    expect(() => normalizeAndEnsureValid('JoH!n.TeST')).toThrow(
      'Invalid characters in handle',
    )
  })
})
