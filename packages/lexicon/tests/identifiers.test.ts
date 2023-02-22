import {
  lexVerifyHandle,
  lexVerifyHandleRegex,
  lexVerifyNsid,
  lexVerifyNsidRegex,
} from '../src/identifiers'

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

describe('NSID permissive validation', () => {
  const expectValid = (h: string) => {
    lexVerifyNsid(h)
    lexVerifyNsidRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => lexVerifyNsid(h)).toThrow()
    expect(() => lexVerifyNsidRegex(h)).toThrow()
  }

  it('enforces spec details', () => {
    expectValid('com.example.foo')
    const longNsid = 'com.' + 'o'.repeat(63) + '.foo'
    expectValid(longNsid)

    const tooLongNsid = 'com.' + 'o'.repeat(64) + '.foo'
    expectInvalid(tooLongNsid)

    const longEnd = 'com.example.' + 'o'.repeat(128)
    expectValid(longEnd)

    const tooLongEnd = 'com.example.' + 'o'.repeat(129)
    expectInvalid(tooLongEnd)

    const longOverall = 'com.' + 'middle.'.repeat(50) + 'foo'
    expect(longOverall.length).toBe(357)
    expectValid(longOverall)

    const tooLongOverall = 'com.' + 'middle.'.repeat(100) + 'foo'
    expect(tooLongOverall.length).toBe(707)
    expectInvalid(tooLongOverall)

    expectValid('a.b.c')
    expectValid('a0.b1.c3')
    expectValid('a-0.b-1.c-3')
    expectValid('m.xn--masekowski-d0b.pl')
    expectValid('one.two.three')

    expectInvalid('com.example')
    expectInvalid('a.0.c')
    expectInvalid('a.')
    expectInvalid('.one.two.three')
    expectInvalid('one.two.three ')
    expectInvalid('one.two..three')
    expectInvalid('one .two.three')
    expectInvalid(' one.two.three')
    expectInvalid('com.exa💩ple.thing')
    expectInvalid('com.atproto.feed.p@st')
    expectInvalid('com.atproto.feed.p_st')
    expectInvalid('com.atproto.feed.p*st')
    expectInvalid('com.atproto.feed.po#t')
    expectInvalid('com.atproto.feed.p!ot')
  })

  it('is mostly consistent with nsid package', () => {
    expectValid('com.example.foo')
    expectValid('com.long-thing1.cool.fooBarBaz')
    expectValid('cool.long-thing1.com')
    expectInvalid('example.com')
    expectInvalid('com.1example.foo')
    expectInvalid('com.example!.foo')
    expectInvalid('com.example.*.foo')
    expectInvalid('foo')
    expectInvalid('foo/bar')
  })

  it('handles corner-cases which nsid package does not', () => {
    expectInvalid('com.example-.foo')
  })
})
