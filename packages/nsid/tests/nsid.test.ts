import {
  ensureValidNsid,
  ensureValidNsidRegex,
  InvalidNsidError,
  NSID,
} from '../src'

describe('NSID parsing & creation', () => {
  it('parses valid NSIDs', () => {
    expect(NSID.parse('com.example.foo').authority).toBe('example.com')
    expect(NSID.parse('com.example.foo').name).toBe('foo')
    expect(NSID.parse('com.example.foo').toString()).toBe('com.example.foo')
    expect(NSID.parse('com.example.*').authority).toBe('example.com')
    expect(NSID.parse('com.example.*').name).toBe('*')
    expect(NSID.parse('com.example.*').toString()).toBe('com.example.*')
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').name).toBe('fooBarBaz')
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })

  it('creates valid NSIDs', () => {
    expect(NSID.create('example.com', 'foo').authority).toBe('example.com')
    expect(NSID.create('example.com', 'foo').name).toBe('foo')
    expect(NSID.create('example.com', 'foo').toString()).toBe('com.example.foo')
    expect(NSID.create('example.com', '*').authority).toBe('example.com')
    expect(NSID.create('example.com', '*').name).toBe('*')
    expect(NSID.create('example.com', '*').toString()).toBe('com.example.*')
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').name).toBe(
      'fooBarBaz',
    )
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })
})

describe('NSID validation', () => {
  const expectValid = (h: string) => {
    ensureValidNsid(h)
    ensureValidNsidRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => ensureValidNsid(h)).toThrow(InvalidNsidError)
    expect(() => ensureValidNsidRegex(h)).toThrow(InvalidNsidError)
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

    expectInvalid('example.com')
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
