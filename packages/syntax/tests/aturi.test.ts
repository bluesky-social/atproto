import { readFileSync } from 'node:fs'
import { describe, expect, it, test } from 'vitest'
import { AtUri } from '../src'

describe(AtUri, () => {
  describe('parses valid interop', () => {
    for (const value of readLines(
      `${__dirname}/../../../interop-test-files/syntax/aturi_syntax_valid.txt`,
    )) {
      test(value, () => {
        expect(() => new AtUri(value)).not.toThrow()
      })
    }
  })

  describe('valid at uris', () => {
    type AtUriTest = [
      input: string,
      host: string,
      path: string,
      query: string,
      hash: string,
    ]
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
    for (const [input, host, path, search, hash] of TESTS) {
      test(input, () => {
        const urip = new AtUri(input)
        expect(urip.protocol).toBe('at:')
        expect(urip.host).toBe(host)
        expect(urip.hostname).toBe(host)
        expect(urip.origin).toBe(`at://${host}`)
        expect(urip.pathname).toBe(path)
        expect(urip.search).toBe(search)
        expect(urip.hash).toBe(hash)
      })
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
    expect(urip.toString()).toBe('at://foo.com')

    urip.host = 'bar.com'
    expect(urip.toString()).toBe('at://bar.com')
    urip.host = 'did:web:localhost%3A1234'
    expect(urip.toString()).toBe('at://did:web:localhost%3A1234')
    urip.host = 'foo.com'

    urip.pathname = '/'
    expect(urip.toString()).toBe('at://foo.com')
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

  describe('relative URIs', () => {
    type AtUriTest = [input: string, path: string, search: string, hash: string]
    const TESTS: AtUriTest[] = [
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
      describe(base, () => {
        for (const [input, path, search, hash] of TESTS) {
          test(input, () => {
            const baseUri = new AtUri(base)
            const uri = new AtUri(input, base)
            expect(uri.protocol).toBe('at:')
            expect(uri.host).toBe(baseUri.host)
            expect(uri.hostname).toBe(baseUri.hostname)
            expect(uri.origin).toBe(baseUri.origin)
            expect(uri.pathname).toBe(path)
            expect(uri.search).toBe(search)
            expect(uri.hash).toBe(hash)
          })
        }
      })
    }
  })

  it('properly checks that the did property is a valid did', () => {
    const urip = new AtUri('at://did:example:123')
    expect(urip.did).toBe('did:example:123')
    urip.host = 'did:example:456'
    expect(urip.did).toBe('did:example:456')
    urip.host = 'foo.com'
    expect(() => urip.did).toThrow()
  })

  it('properly checks that the collection is a valid nsid', () => {
    const urip = new AtUri('at://foo.com')
    expect(urip.collection).toBe('')
    expect(() => urip.collectionSafe).toThrow()

    urip.collection = 'com.example.foo'
    expect(urip.collection).toBe('com.example.foo')
    expect(urip.collectionSafe).toBe('com.example.foo')

    urip.collection = 'com.other.foo'
    expect(urip.collection).toBe('com.other.foo')
    expect(urip.collectionSafe).toBe('com.other.foo')

    expect(() => (urip.collection = 'not a valid nsid')).toThrow()
    expect(urip.collection).toBe('com.other.foo') // unchanged after failed set

    urip.unsafelySetCollection('not-a-valid-nsid')
    expect(urip.collection).toBe('not-a-valid-nsid')
    expect(() => urip.collectionSafe).toThrow()
  })

  it('properly checks that the rkey is a valid record key', () => {
    const urip = new AtUri('at://foo.com')
    expect(urip.rkey).toBe('')
    expect(() => urip.rkeySafe).toThrow()

    urip.rkey = 'valid_rkey-123'
    expect(urip.rkey).toBe('valid_rkey-123')
    expect(urip.rkeySafe).toBe('valid_rkey-123')

    expect(() => (urip.rkey = 'not a valid rkey')).toThrow()
    expect(urip.rkey).toBe('valid_rkey-123') // unchanged after failed set

    urip.unsafelySetRkey('not a valid rkey')
    expect(urip.rkey).toBe('not a valid rkey')
    expect(() => urip.rkeySafe).toThrow()
  })
})

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
