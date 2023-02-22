import {
  lexVerifyHandle,
  lexVerifyHandleRegex,
  lexVerifyNsid,
  lexVerifyNsidRegex,
  lexVerifyDid,
  lexVerifyDidRegex,
  lexVerifyAtUri,
  lexVerifyAtUriRegex,
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
    expectValid('laptop.local')
    expectValid('laptop.arpa')

    // NOTE: this probably isn't ever going to be a real domain, but my read of
    // the RFC is that it would be possible
    expectValid('john.t')
  })

  it('allows punycode handles', () => {
    expectValid('xn--ls8h.test') // 💩.test
    expectValid('xn--bcher-kva.tld') // bücher.tld
  })

  it('allows onion (Tor) handles', () => {
    expectValid('expyuzz4wqqyqhjn.onion')
    expectValid('friend.expyuzz4wqqyqhjn.onion')
    expectValid(
      'g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      '2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
  })

  it('throws on invalid handles', () => {
    expectInvalid('did:thing.test')
    expectInvalid('did:thing')
    expectInvalid('john-.test')
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
    expectInvalid('joh-.test')
    expectInvalid('john.-est')
    expectInvalid('john.tes-')
  })

  it('correctly validates corner cases (modern vs. old RFCs)', () => {
    expectValid('12345.test')
    expectValid('8.cn')
    expectValid('4chan.org')
    expectValid('4chan.o-g')
    expectValid('blah.4chan.org')
    expectValid('thing.a01')
    expectValid('120.0.0.1.com')
    expectValid('0john.test')
    expectValid('9sta--ck.com')
    expectValid('99stack.com')
    expectValid('0ohn.test')
    expectValid('john.t--t')
    expectValid('thing.0aa.thing')

    expectInvalid('cn.8')
    expectInvalid('thing.0aa')
    expectInvalid('thing.0aa')
  })

  it('does not allow IP addresses as handles', () => {
    expectInvalid('127.0.0.1')
    expectInvalid('192.168.0.142')
    expectInvalid('fe80::7325:8a97:c100:94b')
    expectInvalid('2600:3c03::f03c:9100:feb0:af1f')
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

  it('allows onion (Tor) NSIDs', () => {
    expectValid('onion.expyuzz4wqqyqhjn.spec.getThing')
    expectValid(
      'onion.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    )
  })

  it('blocks starting-with-numeric segments (differently from domains)', () => {
    expectInvalid('org.4chan.lex.getThing')
    expectInvalid('cn.8.lex.stuff')
    expectInvalid(
      'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    )
  })
})

describe('DID permissive validation', () => {
  const expectValid = (h: string) => {
    lexVerifyDid(h)
    lexVerifyDidRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => lexVerifyDid(h)).toThrow()
    expect(() => lexVerifyDidRegex(h)).toThrow()
  }

  it('enforces spec details', () => {
    expectValid('did:method:val')
    expectValid('did:method:VAL')
    expectValid('did:method:val123')
    expectValid('did:method:123')
    expectValid('did:method:val-two')
    expectValid('did:method:val_two')
    expectValid('did:method:val.two')
    expectValid('did:method:val:two')
    expectValid('did:method:val%BB')

    expectInvalid('did')
    expectInvalid('didmethodval')
    expectInvalid('method:did:val')
    expectInvalid('did:method:')
    expectInvalid('didmethod:val')
    expectInvalid('did:methodval')
    expectInvalid(':did:method:val')
    expectInvalid('did.method.val')
    expectInvalid('did:method:val:')
    expectInvalid('did:method:val%')
    expectInvalid('DID:method:val')
    expectInvalid('did:METHOD:val')
    expectInvalid('did:m123:val')

    expectValid('did:method:' + 'v'.repeat(240))
    expectInvalid('did:method:' + 'v'.repeat(8500))

    expectValid('did:m:v')
    expectValid('did:method::::val')
    expectValid('did:method:-')
    expectValid('did:method:-:_:.:%ab')
    expectValid('did:method:.')
    expectValid('did:method:_')
    expectValid('did:method::.')

    expectInvalid('did:method:val/two')
    expectInvalid('did:method:val?two')
    expectInvalid('did:method:val#two')
    expectInvalid('did:method:val%')

    expectValid(
      'did:onion:2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid',
    )
  })

  it('allows some real DID values', () => {
    expectValid('did:example:123456789abcdefghi')
    expectValid('did:plc:7iza6de2dwap2sbkpav7c6c6')
    expectValid('did:web:example.com')
    expectValid('did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N')
    expectValid('did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a')
  })
})

describe('ATURI permissive validation', () => {
  const expectValid = (h: string) => {
    lexVerifyAtUri(h)
    lexVerifyAtUriRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => lexVerifyAtUri(h)).toThrow()
    expect(() => lexVerifyAtUriRegex(h)).toThrow()
  }

  it('enforces spec basics', () => {
    expectValid('at://did:plc:asdf123')
    expectValid('at://user.bsky.social')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/record')

    expectValid('at://did:plc:asdf123#/frag')
    expectValid('at://user.bsky.social#/frag')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post#/frag')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/record#/frag')

    expectInvalid('a://did:plc:asdf123')
    expectInvalid('at//did:plc:asdf123')
    expectInvalid('at:/a/did:plc:asdf123')
    expectInvalid('at:/did:plc:asdf123')
    expectInvalid('AT://did:plc:asdf123')
    expectInvalid('http://did:plc:asdf123')
    expectInvalid('://did:plc:asdf123')
    expectInvalid('at:did:plc:asdf123')
    expectInvalid('at:/did:plc:asdf123')
    expectInvalid('at:///did:plc:asdf123')
    expectInvalid('at://:/did:plc:asdf123')
    expectInvalid('at:/ /did:plc:asdf123')
    expectInvalid('at://did:plc:asdf123 ')
    expectInvalid('at://did:plc:asdf123/ ')
    expectInvalid(' at://did:plc:asdf123')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post ')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post# ')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post#/ ')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post#/frag ')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post#fr ag')
    expectInvalid('//did:plc:asdf123')
    expectInvalid('at://name')
    expectInvalid('at://name.0')
    expectInvalid('at://diD:plc:asdf123')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.p@st')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.p$st')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.p%st')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.p&st')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.*')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.p()t')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed_post')
    expectInvalid('at://did:plc:asdf123/-com.atproto.feed.post')
    expectInvalid('at://did:plc:asdf@123/com.atproto.feed.post')

    expectInvalid('at://DID:plc:asdf123')
    expectInvalid('at://user.bsky.123')
    expectInvalid('at://bsky')
    expectInvalid('at://did:plc:')
    expectInvalid('at://did:plc:')
    expectInvalid('at://frag')

    expectValid('at://did:plc:asdf123/com.atproto.feed.post/' + 'o'.repeat(800))
    expectInvalid(
      'at://did:plc:asdf123/com.atproto.feed.post/' + 'o'.repeat(8200),
    )
  })

  it('has specified behavior on edge cases', () => {
    expectInvalid('at://user.bsky.social//')
    expectInvalid('at://user.bsky.social//com.atproto.feed.post')
    expectInvalid('at://user.bsky.social/com.atproto.feed.post//')
    expectInvalid(
      'at://did:plc:asdf123/com.atproto.feed.post/asdf123/more/more',
    )
    expectInvalid('at://did:plc:asdf123/short/stuff')
    expectInvalid('at://did:plc:asdf123/12345')
  })

  it('enforces no trailing slashes', () => {
    expectValid('at://did:plc:asdf123')
    expectInvalid('at://did:plc:asdf123/')

    expectValid('at://user.bsky.social')
    expectInvalid('at://user.bsky.social/')

    expectValid('at://did:plc:asdf123/com.atproto.feed.post')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post/')

    expectValid('at://did:plc:asdf123/com.atproto.feed.post/record')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post/record/')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post/record/#/frag')
  })

  it('enforces strict paths', () => {
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/asdf123')
    expectInvalid('at://did:plc:asdf123/com.atproto.feed.post/asdf123/asdf')
  })

  it('is very permissive about record keys', () => {
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/asdf123')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/a')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%23')

    expectValid('at://did:plc:asdf123/com.atproto.feed.post/$@!*)(:,;~.sdf123')
    expectValid("at://did:plc:asdf123/com.atproto.feed.post/~'sdf123")

    expectValid('at://did:plc:asdf123/com.atproto.feed.post/$')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/@')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/!')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/*')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/(')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/,')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/;')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/abc%30123')
  })

  it('is probably too permissive about URL encoding', () => {
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%30')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%3')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%zz')
    expectValid('at://did:plc:asdf123/com.atproto.feed.post/%%%')
  })

  it('is very permissive about fragments', () => {
    expectValid('at://did:plc:asdf123#/frac')

    expectInvalid('at://did:plc:asdf123#')
    expectInvalid('at://did:plc:asdf123##')
    expectInvalid('#at://did:plc:asdf123')
    expectInvalid('at://did:plc:asdf123#/asdf#/asdf')

    expectValid('at://did:plc:asdf123#/com.atproto.feed.post')
    expectValid('at://did:plc:asdf123#/com.atproto.feed.post/')
    expectValid('at://did:plc:asdf123#/asdf/')

    expectValid('at://did:plc:asdf123/com.atproto.feed.post#/$@!*():,;~.sdf123')
    expectValid('at://did:plc:asdf123#/[asfd]')

    expectValid('at://did:plc:asdf123#/$')
    expectValid('at://did:plc:asdf123#/*')
    expectValid('at://did:plc:asdf123#/;')
    expectValid('at://did:plc:asdf123#/,')
  })
})
