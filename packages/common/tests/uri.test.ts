import { AdxUri } from '../src/network/uri'

describe('Adx Uris', () => {
  it('parses valid Adx Uris', () => {
    //                 input   host    path    query   hash
    type AdxUriTest = [string, string, string, string, string]
    const TESTS: AdxUriTest[] = [
      ['foo.com', 'foo.com', '', '', ''],
      ['adx://foo.com', 'foo.com', '', '', ''],
      ['adx://foo.com/', 'foo.com', '/', '', ''],
      ['adx://foo.com/foo', 'foo.com', '/foo', '', ''],
      ['adx://foo.com/foo/', 'foo.com', '/foo/', '', ''],
      ['adx://foo.com/foo/bar', 'foo.com', '/foo/bar', '', ''],
      ['adx://foo.com?foo=bar', 'foo.com', '', 'foo=bar', ''],
      ['adx://foo.com?foo=bar&baz=buux', 'foo.com', '', 'foo=bar&baz=buux', ''],
      ['adx://foo.com/?foo=bar', 'foo.com', '/', 'foo=bar', ''],
      ['adx://foo.com/foo?foo=bar', 'foo.com', '/foo', 'foo=bar', ''],
      ['adx://foo.com/foo/?foo=bar', 'foo.com', '/foo/', 'foo=bar', ''],
      ['adx://foo.com#hash', 'foo.com', '', '', '#hash'],
      ['adx://foo.com/#hash', 'foo.com', '/', '', '#hash'],
      ['adx://foo.com/foo#hash', 'foo.com', '/foo', '', '#hash'],
      ['adx://foo.com/foo/#hash', 'foo.com', '/foo/', '', '#hash'],
      ['adx://foo.com?foo=bar#hash', 'foo.com', '', 'foo=bar', '#hash'],

      [
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/bar',
        '',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar&baz=buux',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar&baz=buux',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        'foo=bar',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        'foo=bar',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/?foo=bar',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        'foo=bar',
        '',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        '',
        '#hash',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/',
        '',
        '#hash',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo',
        '',
        '#hash',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '/foo/',
        '',
        '#hash',
      ],
      [
        'adx://did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar#hash',
        'did:example:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
        '',
        'foo=bar',
        '#hash',
      ],

      ['did:web:localhost%3A1234', 'did:web:localhost%3A1234', '', '', ''],
      [
        'adx://did:web:localhost%3A1234',
        'did:web:localhost%3A1234',
        '',
        '',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/',
        'did:web:localhost%3A1234',
        '/',
        '',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/foo',
        'did:web:localhost%3A1234',
        '/foo',
        '',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/foo/',
        'did:web:localhost%3A1234',
        '/foo/',
        '',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/foo/bar',
        'did:web:localhost%3A1234',
        '/foo/bar',
        '',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234?foo=bar',
        'did:web:localhost%3A1234',
        '',
        'foo=bar',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234?foo=bar&baz=buux',
        'did:web:localhost%3A1234',
        '',
        'foo=bar&baz=buux',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/?foo=bar',
        'did:web:localhost%3A1234',
        '/',
        'foo=bar',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/foo?foo=bar',
        'did:web:localhost%3A1234',
        '/foo',
        'foo=bar',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234/foo/?foo=bar',
        'did:web:localhost%3A1234',
        '/foo/',
        'foo=bar',
        '',
      ],
      [
        'adx://did:web:localhost%3A1234#hash',
        'did:web:localhost%3A1234',
        '',
        '',
        '#hash',
      ],
      [
        'adx://did:web:localhost%3A1234/#hash',
        'did:web:localhost%3A1234',
        '/',
        '',
        '#hash',
      ],
      [
        'adx://did:web:localhost%3A1234/foo#hash',
        'did:web:localhost%3A1234',
        '/foo',
        '',
        '#hash',
      ],
      [
        'adx://did:web:localhost%3A1234/foo/#hash',
        'did:web:localhost%3A1234',
        '/foo/',
        '',
        '#hash',
      ],
      [
        'adx://did:web:localhost%3A1234?foo=bar#hash',
        'did:web:localhost%3A1234',
        '',
        'foo=bar',
        '#hash',
      ],
    ]
    for (const [uri, hostname, pathname, search, hash] of TESTS) {
      const urip = new AdxUri(uri)
      expect(urip.protocol).toBe('adx:')
      expect(urip.host).toBe(hostname)
      expect(urip.hostname).toBe(hostname)
      expect(urip.origin).toBe(`adx://${hostname}`)
      expect(urip.pathname).toBe(pathname)
      expect(urip.search).toBe(search)
      expect(urip.hash).toBe(hash)
    }
  })

  it('handles ADX-specific parsing', () => {
    {
      const urip = new AdxUri('adx://foo.com')
      expect(urip.collection).toBe('')
      expect(urip.recordKey).toBe('')
    }
    {
      const urip = new AdxUri('adx://foo.com/com.example.foo')
      expect(urip.collection).toBe('com.example.foo')
      expect(urip.recordKey).toBe('')
    }
    {
      const urip = new AdxUri('adx://foo.com/com.example.foo/123')
      expect(urip.collection).toBe('com.example.foo')
      expect(urip.recordKey).toBe('123')
    }
  })

  it('supports modifications', () => {
    const urip = new AdxUri('adx://foo.com')
    expect(urip.toString()).toBe('adx://foo.com/')

    urip.host = 'bar.com'
    expect(urip.toString()).toBe('adx://bar.com/')
    urip.host = 'did:web:localhost%3A1234'
    expect(urip.toString()).toBe('adx://did:web:localhost%3A1234/')
    urip.host = 'foo.com'

    urip.pathname = '/'
    expect(urip.toString()).toBe('adx://foo.com/')
    urip.pathname = '/foo'
    expect(urip.toString()).toBe('adx://foo.com/foo')
    urip.pathname = 'foo'
    expect(urip.toString()).toBe('adx://foo.com/foo')

    urip.collection = 'com.example.foo'
    urip.recordKey = '123'
    expect(urip.toString()).toBe('adx://foo.com/com.example.foo/123')
    urip.recordKey = '124'
    expect(urip.toString()).toBe('adx://foo.com/com.example.foo/124')
    urip.collection = 'com.other.foo'
    expect(urip.toString()).toBe('adx://foo.com/com.other.foo/124')
    urip.pathname = ''
    urip.recordKey = '123'
    expect(urip.toString()).toBe('adx://foo.com/undefined/123')
    urip.pathname = 'foo'

    urip.search = '?foo=bar'
    expect(urip.toString()).toBe('adx://foo.com/foo?foo=bar')
    urip.searchParams.set('baz', 'buux')
    expect(urip.toString()).toBe('adx://foo.com/foo?foo=bar&baz=buux')

    urip.hash = '#hash'
    expect(urip.toString()).toBe('adx://foo.com/foo?foo=bar&baz=buux#hash')
    urip.hash = 'hash'
    expect(urip.toString()).toBe('adx://foo.com/foo?foo=bar&baz=buux#hash')
  })

  it('supports relative URIs', () => {
    //                 input   path    query   hash
    type AdxUriTest = [string, string, string, string]
    const TESTS: AdxUriTest[] = [
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
      'adx://did:web:localhost%3A1234',
      'adx://did:web:localhost%3A1234/foo/bar?foo=bar&baz=buux#hash',
      'did:web:localhost%3A1234',
      'adx://did:web:localhost%3A1234',
      'adx://did:web:localhost%3A1234/foo/bar?foo=bar&baz=buux#hash',
    ]

    for (const base of BASES) {
      const basep = new AdxUri(base)
      for (const [relative, pathname, search, hash] of TESTS) {
        const urip = new AdxUri(relative, base)
        expect(urip.protocol).toBe('adx:')
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
