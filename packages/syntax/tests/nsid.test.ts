import {
  ensureValidNsid,
  ensureValidNsidRegex,
  InvalidNsidError,
  NSID,
} from '../src'
import * as readline from 'readline'
import * as fs from 'fs'

describe('NSID parsing & creation', () => {
  it('parses valid NSIDs', () => {
    expect(NSID.parse('com.example.foo').authority).toBe('example.com')
    expect(NSID.parse('com.example.foo').name).toBe('foo')
    expect(NSID.parse('com.example.foo').toString()).toBe('com.example.foo')
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

    const longEnd = 'com.example.' + 'o'.repeat(63)
    expectValid(longEnd)

    const tooLongEnd = 'com.example.' + 'o'.repeat(64)
    expectInvalid(tooLongEnd)

    const longOverall = 'com.' + 'middle.'.repeat(40) + 'foo'
    expect(longOverall.length).toBe(287)
    expectValid(longOverall)

    const tooLongOverall = 'com.' + 'middle.'.repeat(50) + 'foo'
    expect(tooLongOverall.length).toBe(357)
    expectInvalid(tooLongOverall)

    expectValid('com.example.fooBar')
    expectValid('net.users.bob.ping')
    expectValid('a.b.c')
    expectValid('m.xn--masekowski-d0b.pl')
    expectValid('one.two.three')
    expectValid('one.two.three.four-and.FiVe')
    expectValid('one.2.three')
    expectValid('a-0.b-1.c')
    expectValid('a0.b1.cc')
    expectValid('cn.8.lex.stuff')
    expectValid('test.12345.record')
    expectValid('a01.thing.record')
    expectValid('a.0.c')
    expectValid('xn--fiqs8s.xn--fiqa61au8b7zsevnm8ak20mc4a87e.record.two')

    expectInvalid('com.example.foo.*')
    expectInvalid('com.example.foo.blah*')
    expectInvalid('com.example.foo.*blah')
    expectInvalid('com.example.f00')
    expectInvalid('com.exa💩ple.thing')
    expectInvalid('a-0.b-1.c-3')
    expectInvalid('a-0.b-1.c-o')
    expectInvalid('a0.b1.c3')
    expectInvalid('1.0.0.127.record')
    expectInvalid('0two.example.foo')
    expectInvalid('example.com')
    expectInvalid('com.example')
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

  it('allows starting-with-numeric segments (same as domains)', () => {
    expectValid('org.4chan.lex.getThing')
    expectValid('cn.8.lex.stuff')
    expectValid(
      'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    )
  })

  it('conforms to interop valid NSIDs', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/nsid_syntax_valid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectValid(line)
    })
  })

  it('conforms to interop invalid NSIDs', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/nsid_syntax_invalid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectInvalid(line)
    })
  })
})
