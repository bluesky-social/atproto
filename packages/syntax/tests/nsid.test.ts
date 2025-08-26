import * as fs from 'node:fs'
import * as readline from 'node:readline'
import { NSID, isValidNsid, validateNsid } from '../src'

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

describe('validateNsid', () => {
  describe('valid NSIDs', () => {
    for (const validNsid of [
      'com.example.foo',
      'o'.repeat(63) + '.foo.bar',
      'com.' + 'o'.repeat(63) + '.foo',
      'com.example.' + 'o'.repeat(63),
      'com.' + 'middle.'.repeat(40) + 'foo',
      'com.example.fooBar',
      'net.users.bob.ping',
      'a.b.c',
      'm.xn--masekowski-d0b.pl',
      'one.two.three',
      'one.two.three.four-and.FiVe',
      'one.2.three',
      'a-0.b-1.c',
      'a0.b1.cc',
      'cn.8.lex.stuff',
      'test.12345.record',
      'a01.thing.record',
      'a.0.c',
      'xn--fiqs8s.xn--fiqa61au8b7zsevnm8ak20mc4a87e.record.two',
      'a0.b1.c3',
      'com.example.f00',
      'onion.expyuzz4wqqyqhjn.spec.getThing',
      'onion.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
      'org.4chan.lex.getThing',
      'cn.8.lex.stuff',
      'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    ]) {
      it(validNsid, () => {
        expect(validateNsid(validNsid)).toMatchObject({
          success: true,
          value: expect.any(Array),
        })
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

  describe('interop valid NSIDs', () => {
    it('conforms to interop valid NSIDs', async () => {
      const lineReader = readline.createInterface({
        input: fs.createReadStream(
          `${__dirname}/interop-files/nsid_syntax_valid.txt`,
        ),
        terminal: false,
      })
      for await (const line of lineReader) {
        if (line.startsWith('#') || line.length === 0) {
          continue
        }

        expect(isValidNsid(line)).toBe(true)
      }
    })
  })

  describe('interop invalid NSIDs', () => {
    it('conforms to interop invalid NSIDs', async () => {
      const lineReader = readline.createInterface({
        input: fs.createReadStream(
          `${__dirname}/interop-files/nsid_syntax_invalid.txt`,
        ),
        terminal: false,
      })
      for await (const line of lineReader) {
        if (line.startsWith('#') || line.length === 0) {
          continue
        }

        expect(validateNsid(line)).not.toBeNull()
      }
    })
  })
})
