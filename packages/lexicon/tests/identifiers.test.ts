import { lexVerifyHandle, lexVerifyHandleRegex } from '../src/identifiers'

describe('handle permissive validation', () => {
  const expectValid = (h: string) => {
    lexVerifyHandle(h)
    lexVerifyHandleRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => lexVerifyHandle(h)).toThrow()
    expect(() => lexVerifyHandleRegex(h)).toThrow()
  }

  it('allows valid handles', () => {
    expectValid('A.ISI.EDU')
    expectValid('XX.LCS.MIT.EDU')
    expectValid('SRI-NIC.ARPA')
    expectValid('john.test')
    expectValid('jan.test')
    expectValid('a234567890123456789.test')
    expectValid('john2.test')
    expectValid('john-john.test')
    expectValid('john.bsky.app')
    expectValid('jo.hn')
    expectValid('a.co')
    expectValid('a.org')
    expectValid('joh.n')
    expectValid('j0.h0')
    const longHandle =
      'shoooort' + '.loooooooooooooooooooooooooong'.repeat(8) + '.test'
    expect(longHandle.length).toEqual(253)
    expectValid(longHandle)
    expectValid('short.' + 'o'.repeat(63) + '.test')
    expectValid('jaymome-johnber123456.test')
    expectValid('jay.mome-johnber123456.test')
    expectValid('john.test.bsky.app')

    // NOTE: this probably isn't ever going to be a real domain, but my read of
    // the RFC is that it would be possible
    expectValid('john.t')
  })

  it('allows punycode handles', () => {
    expectValid('xn--ls8h.test') // 💩.test
    expectValid('xn--bcher-kva.tld') // bücher.tld
  })

  it('throws on invalid handles', () => {
    expectInvalid('12345.test')
    expectInvalid('did:thing.test')
    expectInvalid('did:thing')
    expectInvalid('john-.test')
    expectInvalid('0john.test')
    expectInvalid('john.0')
    expectInvalid('john.-')
    expectInvalid('short.' + 'o'.repeat(64) + '.test')
    expectInvalid('short' + '.loooooooooooooooooooooooong'.repeat(10) + '.test')
    const longHandle =
      'shooooort' + '.loooooooooooooooooooooooooong'.repeat(8) + '.test'
    expect(longHandle.length).toEqual(254)
    expectInvalid(longHandle)
    expectInvalid('xn--bcher-.tld')
    expectInvalid('john..test')
    expectInvalid('jo_hn.test')
    expectInvalid('-john.test')
    expectInvalid('.john.test')
    expectInvalid('jo!hn.test')
    expectInvalid('jo%hn.test')
    expectInvalid('jo&hn.test')
    expectInvalid('jo@hn.test')
    expectInvalid('jo*hn.test')
    expectInvalid('jo|hn.test')
    expectInvalid('jo:hn.test')
    expectInvalid('jo/hn.test')
    expectInvalid('john💩.test')
    expectInvalid('bücher.test')
    expectInvalid('john .test')
    expectInvalid('john.test.')
    expectInvalid('john')
    expectInvalid('john.')
    expectInvalid('.john')
    expectInvalid('john.test.')
    expectInvalid('.john.test')
    expectInvalid(' john.test')
    expectInvalid('john.test ')
    expectInvalid('0ohn.test')
    expectInvalid('joh-.test')
  })

  it('is consistent with examples from stackoverflow', () => {
    const okStackoverflow = [
      'stack.com',
      'sta-ck.com',
      'sta---ck.com',
      'sta--ck9.com',
      'stack99.com',
      'sta99ck.com',
      'google.com.uk',
      'google.co.in',
      'google.com',
      'maselkowski.pl',
      'm.maselkowski.pl',
      'xn--masekowski-d0b.pl',
      'xn--fiqa61au8b7zsevnm8ak20mc4a87e.xn--fiqs8s',
      'xn--stackoverflow.com',
      'stackoverflow.xn--com',
      'stackoverflow.co.uk',
      'xn--masekowski-d0b.pl',
      'xn--fiqa61au8b7zsevnm8ak20mc4a87e.xn--fiqs8s',
    ]
    okStackoverflow.forEach(expectValid)

    const badStackoverflow = [
      '-notvalid.at-all',
      '-thing.com',
      '9sta--ck.com',
      '99stack.com',
      'www.masełkowski.pl.com',
    ]
    badStackoverflow.forEach(expectInvalid)
  })
})
