import { ensureValid, normalizeAndEnsureValid } from '../src'

describe('handle validation', () => {
  const domains = ['.bsky.app', '.test']
  const check = (toCheck: string) => () => {
    return ensureValid(toCheck, domains)
  }

  it('allows valid handles', () => {
    check('john.test')
    check('jan.test')
    check('a234567890123456789.test')
    check('john2.test')
    check('john-john.test')
    check('john-.test')
    check('john.bsky.app')
    check('0john.test')
    check('12345.test')
    check(
      'short.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.test',
    )
  })

  it('allows punycode handles', () => {
    check('xn--ls8h.test') // 💩.test
    check('xn--bcher-kva.tld') // bücher.tld
  })

  it('throws on invalid handles', () => {
    expect(check('did:john.test')).toThrow(
      'Cannot register a handle that starts with `did:`',
    )
    expect(check('john.bsky.io')).toThrow('Not a supported handle domain')
    expect(check('john.com')).toThrow('Not a supported handle domain')
    expect(check('j.test')).toThrow('Handle too short')
    expect(check('uk.test')).toThrow('Handle too short')
    expect(check('jaymome-johnber123456.test')).toThrow('Handle too long')
    expect(check('jay.mome-johnber123456.test')).toThrow('Handle too long')
    expect(
      check(
        'short.loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong.test',
      ),
    ).toThrow('Handle too long')
    expect(
      check(
        'short.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.loooooooooooooooooooooooong.test',
      ),
    ).toThrow('Handle too long')
    expect(check('john.test.bsky.app')).toThrow('Invalid characters in handle')
    expect(check('john..test')).toThrow('Invalid characters in handle')
    expect(check('jo_hn.test')).toThrow('Invalid characters in handle')
    expect(check('-john.test')).toThrow('Invalid characters in handle')
    expect(check('.john.test')).toThrow('Invalid characters in handle')
    expect(check('jo!hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo%hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo&hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo@hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo*hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo|hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo:hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo/hn.test')).toThrow('Invalid characters in handle')
    expect(check('john💩.test')).toThrow('Invalid characters in handle')
    expect(check('bücher.test')).toThrow('Invalid characters in handle')
    expect(check('about.test')).toThrow('Reserved handle')
    expect(check('atp.test')).toThrow('Reserved handle')
    expect(check('barackobama.test')).toThrow('Reserved handle')
  })

  it('normalizes handles', () => {
    const normalized = normalizeAndEnsureValid('JoHn.TeST', domains)
    expect(normalized).toBe('john.test')
  })

  it('throws on invalid normalized handles', () => {
    expect(() => normalizeAndEnsureValid('JoH!n.TeST', domains)).toThrow(
      'Invalid characters in handle',
    )
  })
})
