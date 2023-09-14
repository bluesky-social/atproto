import { AtUri, ensureValidAtUri, ensureValidAtUriRegex } from '../src/index'
import * as readline from 'readline'
import * as fs from 'fs'

describe('At Uris', () => {
  it('parses valid at uris', () => {
    //                 input   host    path    query   hash
    type AtUriTest = [string, string, string, string, string]
    const TESTS: AtUriTest[] = [
      ['foo.com', 'foo.com', '', '', ''],
      ['at://foo.com', 'foo.com', '', '', ''],
      ['at://foo.com/', 'foo.com', '/', '', ''],
      ['at://foo.com/foo', 'foo.com', '/foo', '', ''],
      ['at://foo.com/foo/', 'foo.com', '/foo/', '', ''],
      ['at://foo.com/foo/bar', 'foo.com', '/foo/bar', '', ''],
      ['at://foo.com?foo=bar', 'foo.com', '', 'foo=bar', ''],
      ['at://foo.com?foo=bar&baz=buux', 'foo.com', '', 'foo=bar&baz=buux', ''],
      ['at://foo.com/?foo=bar', 'foo.com', '/', 'foo=bar', ''],
      ['at://foo.com/foo?foo=bar', 'foo.com', '/foo', 'foo=bar', ''],
      ['at://foo.com/foo/?foo=bar', 'foo.com', '/foo/', 'foo=bar', ''],
      ['at://foo.com#hash', 'foo.com', '', '', '#hash'],
      ['at://foo.com/#hash', 'foo.com', '/', '', '#hash'],
      ['at://foo.com/foo#hash', 'foo.com', '/foo', '', '#hash'],
      ['at://foo.com/foo/#hash', 'foo.com', '/foo/', '', '#hash'],
      ['at://foo.com?foo=bar#hash', 'foo.com', '', 'foo=bar', '#hash'],

      [
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/bar',
        '',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar&baz=buux',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar&baz=buux',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        'foo=bar',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        'foo=bar',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        'foo=bar',
        '',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '#hash',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        '',
        '#hash',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        '',
        '#hash',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        '',
        '#hash',
      ],
      [
        'at://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar',
        '#hash',
      ],

      ['did:web:localhost%3A1234', 'did:web:localhost%3A1234', '', '', ''],
      ['at://did:web:localhost%3A1234', 'did:web:localhost%3A1234', '', '', ''],
      [
        'at://did:web:localhost%3A1234/',
        'did:web:localhost%3A1234',
        '/',
        '',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/foo',
        'did:web:localhost%3A1234',
        '/foo',
        '',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/foo/',
        'did:web:localhost%3A1234',
        '/foo/',
        '',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/foo/bar',
        'did:web:localhost%3A1234',
        '/foo/bar',
        '',
        '',
      ],
      [
        'at://did:web:localhost%3A1234?foo=bar',
        'did:web:localhost%3A1234',
        '',
        'foo=bar',
        '',
      ],
      [
        'at://did:web:localhost%3A1234?foo=bar&baz=buux',
        'did:web:localhost%3A1234',
        '',
        'foo=bar&baz=buux',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/?foo=bar',
        'did:web:localhost%3A1234',
        '/',
        'foo=bar',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/foo?foo=bar',
        'did:web:localhost%3A1234',
        '/foo',
        'foo=bar',
        '',
      ],
      [
        'at://did:web:localhost%3A1234/foo/?foo=bar',
        'did:web:localhost%3A1234',
        '/foo/',
        'foo=bar',
        '',
      ],
      [
        'at://did:web:localhost%3A1234#hash',
        'did:web:localhost%3A1234',
        '',
        '',
        '#hash',
      ],
      [
        'at://did:web:localhost%3A1234/#hash',
        'did:web:localhost%3A1234',
        '/',
        '',
        '#hash',
      ],
      [
        'at://did:web:localhost%3A1234/foo#hash',
        'did:web:localhost%3A1234',
        '/foo',
        '',
        '#hash',
      ],
      [
        'at://did:web:localhost%3A1234/foo/#hash',
        'did:web:localhost%3A1234',
        '/foo/',
        '',
        '#hash',
      ],
      [
        'at://did:web:localhost%3A1234?foo=bar#hash',
        'did:web:localhost%3A1234',
        '',
        'foo=bar',
        '#hash',
      ],
      [
        'at://4513echo.bsky.social/app.bsky.feed.post/3jsrpdyf6ss23',
        '4513echo.bsky.social',
        '/app.bsky.feed.post/3jsrpdyf6ss23',
        '',
        '',
      ],
    ]
    for (const [uri, hostname, pathname, search, hash] of TESTS) {
      const urip = new AtUri(uri)
      expect(urip.protocol).toBe('at:')
      expect(urip.host).toBe(hostname)
      expect(urip.hostname).toBe(hostname)
      expect(urip.origin).toBe(`at://${hostname}`)
      expect(urip.pathname).toBe(pathname)
      expect(urip.search).toBe(search)
      expect(urip.hash).toBe(hash)
    }
  })

  it('handles ATP-specific parsing', () => {
    {
      const urip = new AtUri('at://foo.com')
      expect(urip.collection).toBe('')
      expect(urip.rkey).toBe('')
    }
    {
      const urip = new AtUri('at://foo.com/com.example.foo')
      expect(urip.collection).toBe('com.example.foo')
      expect(urip.rkey).toBe('')
    }
    {
      const urip = new AtUri('at://foo.com/com.example.foo/123')
      expect(urip.collection).toBe('com.example.foo')
      expect(urip.rkey).toBe('123')
    }
  })

  it('supports modifications', () => {
    const urip = new AtUri('at://foo.com')
    expect(urip.toString()).toBe('at://foo.com/')

    urip.host = 'bar.com'
    expect(urip.toString()).toBe('at://bar.com/')
    urip.host = 'did:web:localhost%3A1234'
    expect(urip.toString()).toBe('at://did:web:localhost%3A1234/')
    urip.host = 'foo.com'

    urip.pathname = '/'
    expect(urip.toString()).toBe('at://foo.com/')
    urip.pathname = '/foo'
    expect(urip.toString()).toBe('at://foo.com/foo')
    urip.pathname = 'foo'
    expect(urip.toString()).toBe('at://foo.com/foo')

    urip.collection = 'com.example.foo'
    urip.rkey = '123'
    expect(urip.toString()).toBe('at://foo.com/com.example.foo/123')
    urip.rkey = '124'
    expect(urip.toString()).toBe('at://foo.com/com.example.foo/124')
    urip.collection = 'com.other.foo'
    expect(urip.toString()).toBe('at://foo.com/com.other.foo/124')
    urip.pathname = ''
    urip.rkey = '123'
    expect(urip.toString()).toBe('at://foo.com/undefined/123')
    urip.pathname = 'foo'

    urip.search = '?foo=bar'
    expect(urip.toString()).toBe('at://foo.com/foo?foo=bar')
    urip.searchParams.set('baz', 'buux')
    expect(urip.toString()).toBe('at://foo.com/foo?foo=bar&baz=buux')

    urip.hash = '#hash'
    expect(urip.toString()).toBe('at://foo.com/foo?foo=bar&baz=buux#hash')
    urip.hash = 'hash'
    expect(urip.toString()).toBe('at://foo.com/foo?foo=bar&baz=buux#hash')
  })

  it('supports relative URIs', () => {
    //                 input   path    query   hash
    type AtUriTest = [string, string, string, string]
    const TESTS: AtUriTest[] = [
      // input hostname pathname query hash
      ['', '', '', ''],
      ['/', '/', '', ''],
      ['/foo', '/foo', '', ''],
      ['/foo/', '/foo/', '', ''],
      ['/foo/bar', '/foo/bar', '', ''],
      ['?foo=bar', '', 'foo=bar', ''],
      ['?foo=bar&baz=buux', '', 'foo=bar&baz=buux', ''],
      ['/?foo=bar', '/', 'foo=bar', ''],
      ['/foo?foo=bar', '/foo', 'foo=bar', ''],
      ['/foo/?foo=bar', '/foo/', 'foo=bar', ''],
      ['#hash', '', '', '#hash'],
      ['/#hash', '/', '', '#hash'],
      ['/foo#hash', '/foo', '', '#hash'],
      ['/foo/#hash', '/foo/', '', '#hash'],
      ['?foo=bar#hash', '', 'foo=bar', '#hash'],
    ]
    const BASES: string[] = [
      'did:web:localhost%3A1234',
      'at://did:web:localhost%3A1234',
      'at://did:web:localhost%3A1234/foo/bar?foo=bar&baz=buux#hash',
      'did:web:localhost%3A1234',
      'at://did:web:localhost%3A1234',
      'at://did:web:localhost%3A1234/foo/bar?foo=bar&baz=buux#hash',
    ]

    for (const base of BASES) {
      const basep = new AtUri(base)
      for (const [relative, pathname, search, hash] of TESTS) {
        const urip = new AtUri(relative, base)
        expect(urip.protocol).toBe('at:')
        expect(urip.host).toBe(basep.host)
        expect(urip.hostname).toBe(basep.hostname)
        expect(urip.origin).toBe(basep.origin)
        expect(urip.pathname).toBe(pathname)
        expect(urip.search).toBe(search)
        expect(urip.hash).toBe(hash)
      }
    }
  })
})

describe('AtUri validation', () => {
  const expectValid = (h: string) => {
    ensureValidAtUri(h)
    ensureValidAtUriRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => ensureValidAtUri(h)).toThrow()
    expect(() => ensureValidAtUriRegex(h)).toThrow()
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

  it('conforms to interop valid ATURIs', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/aturi_syntax_valid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length == 0) {
        return
      }
      expectValid(line)
    })
  })

  // NOTE: this package is currently more permissive than spec about AT URIs, so invalid cases are not errors
})
