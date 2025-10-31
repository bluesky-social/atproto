import * as fs from 'node:fs'
import {
  InvalidNsidError,
  NSID,
  ensureValidNsid,
  isValidNsid,
  parseNsid,
  validateNsid,
  validateNsidRegex,
} from '../src'

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
    expect(isValidNsid(h)).toBe(true)
    ensureValidNsid(h)
    expect(parseNsid(h)).toEqual(h.split('.'))
    expect(validateNsidRegex(h)).toMatchObject({
      success: true,
      value: expect.any(String),
    })
    expect(validateNsid(h)).toMatchObject({
      success: true,
      value: expect.any(Array),
    })
  }
  const expectInvalid = (h: string) => {
    expect(isValidNsid(h)).toBe(false)
    expect(() => parseNsid(h)).toThrow(InvalidNsidError)
    expect(() => ensureValidNsid(h)).toThrow(InvalidNsidError)
    expect(validateNsidRegex(h)).toMatchObject({
      success: false,
      message: expect.any(String),
    })
    expect(validateNsid(h)).toMatchObject({
      success: false,
      message: expect.any(String),
    })
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
  })

  describe('valid NSIDs', () => {
    for (const validNsid of [
      'com.example.foo',
      'o'.repeat(63) + '.foo.bar',
      'com.' + 'o'.repeat(63) + '.foo',
      'com.example.' + 'o'.repeat(63),
      'com.' + 'middle.'.repeat(40) + 'foo',

      'a-0.b-1.c',
      'a.0.c',
      'a.b.c',
      'a0.b1.c3',
      'a0.b1.cc',
      'a01.thing.record',
      'cn.8.lex.stuff',
      'com.example.f00',
      'com.example.fooBar',
      'm.xn--masekowski-d0b.pl',
      'net.users.bob.ping',
      'one.2.three',
      'one.two.three',
      'one.two.three.four-and.FiVe',
      'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
      'onion.expyuzz4wqqyqhjn.spec.getThing',
      'onion.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
      'org.4chan.lex.getThing',
      'test.12345.record',
      'xn--fiqs8s.xn--fiqa61au8b7zsevnm8ak20mc4a87e.record.two',
    ]) {
      it(validNsid, () => {
        expectValid(validNsid)
      })
    }
  })

  describe('invalid NSIDs', () => {
    for (const invalidNsid of [
      'o'.repeat(64) + '.foo.bar',
      'com.' + 'o'.repeat(64) + '.foo',
      'com.example.' + 'o'.repeat(64),
      'com.' + 'middle.'.repeat(50) + 'foo',
      'com.example.foo.*',
      'com.example.foo.blah*',
      'com.example.foo.*blah',
      'com.exa💩ple.thing',
      'a-0.b-1.c-3',
      'a-0.b-1.c-o',
      '1.0.0.127.record',
      '0two.example.foo',
      'example.com',
      'com.example',
      'a.',
      '.one.two.three',
      'one.two.three ',
      'one.two..three',
      'one .two.three',
      ' one.two.three',
      'com.atproto.feed.p@st',
      'com.atproto.feed.p_st',
      'com.atproto.feed.p*st',
      'com.atproto.feed.po#t',
      'com.atproto.feed.p!ot',
      'com.example-.foo',
      'com.-example.foo',
      'com.example.0foo',
      'com.example.f-o',
    ]) {
      it(invalidNsid, () => {
        expect(validateNsid(invalidNsid)).toMatchObject({
          success: false,
          message: expect.any(String),
        })
      })
    }
  })

  describe('conforms to interop valid NSIDs', () => {
    for (const line of fs
      .readFileSync(`${__dirname}/interop-files/nsid_syntax_valid.txt`)
      .toString()
      .split('\n')) {
      if (line.startsWith('#') || line.length === 0) {
        continue
      }

      it(line, () => {
        expectValid(line)
      })
    }
  })

  describe('conforms to interop invalid NSIDs', () => {
    for (const line of fs
      .readFileSync(`${__dirname}/interop-files/nsid_syntax_invalid.txt`)
      .toString()
      .split('\n')) {
      if (line.startsWith('#') || line.length === 0) {
        continue
      }

      it(line, () => {
        expectInvalid(line)
      })
    }
  })
})
