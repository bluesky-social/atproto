import test from 'ava'
import { AdxUri } from '../src/network/uri.js'

test('Parses valid ADX URIs', (t) => {
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
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo/',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/bar',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo/bar',
      '',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      'foo=bar',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar&baz=buux',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      'foo=bar&baz=buux',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/?foo=bar',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/',
      'foo=bar',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo?foo=bar',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo',
      'foo=bar',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/?foo=bar',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo/',
      'foo=bar',
      '',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw#hash',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      '',
      '#hash',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/#hash',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/',
      '',
      '#hash',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo#hash',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo',
      '',
      '#hash',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw/foo/#hash',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '/foo/',
      '',
      '#hash',
    ],
    [
      'adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw?foo=bar#hash',
      'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw',
      '',
      'foo=bar',
      '#hash',
    ],

    ['did:web:localhost%3A1234', 'did:web:localhost%3A1234', '', '', ''],
    ['adx://did:web:localhost%3A1234', 'did:web:localhost%3A1234', '', '', ''],
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
    t.is(urip.protocol, 'adx:', uri)
    t.is(urip.host, hostname, uri)
    t.is(urip.hostname, hostname, uri)
    t.is(urip.origin, `adx://${hostname}`, uri)
    t.is(urip.pathname, pathname, uri)
    t.is(urip.search, search, uri)
    t.is(urip.hash, hash, uri)
  }
})

test('ADX-specific parsing', (t) => {
  {
    const urip = new AdxUri('adx://foo.com')
    t.is(urip.collection, '')
    t.is(urip.recordKey, '')
  }
  {
    const urip = new AdxUri('adx://foo.com/coll')
    t.is(urip.collection, 'coll')
    t.is(urip.recordKey, '')
  }
  {
    const urip = new AdxUri('adx://foo.com/coll/123')
    t.is(urip.collection, 'coll')
    t.is(urip.recordKey, '123')
  }
})

test('Supports modifications', (t) => {
  const urip = new AdxUri('adx://foo.com')
  t.is(urip.toString(), 'adx://foo.com/')

  urip.host = 'bar.com'
  t.is(urip.toString(), 'adx://bar.com/')
  urip.host = 'did:web:localhost%3A1234'
  t.is(urip.toString(), 'adx://did:web:localhost%3A1234/')
  urip.host = 'foo.com'

  urip.pathname = '/'
  t.is(urip.toString(), 'adx://foo.com/')
  urip.pathname = '/foo'
  t.is(urip.toString(), 'adx://foo.com/foo')
  urip.pathname = 'foo'
  t.is(urip.toString(), 'adx://foo.com/foo')

  urip.collection = 'coll'
  urip.recordKey = '123'
  t.is(urip.toString(), 'adx://foo.com/coll/123')
  urip.recordKey = '124'
  t.is(urip.toString(), 'adx://foo.com/coll/124')
  urip.collection = 'other'
  t.is(urip.toString(), 'adx://foo.com/other/124')
  urip.pathname = ''
  urip.recordKey = '123'
  t.is(urip.toString(), 'adx://foo.com/undefined/123')
  urip.pathname = 'foo'

  urip.search = '?foo=bar'
  t.is(urip.toString(), 'adx://foo.com/foo?foo=bar')
  urip.searchParams.set('baz', 'buux')
  t.is(urip.toString(), 'adx://foo.com/foo?foo=bar&baz=buux')

  urip.hash = '#hash'
  t.is(urip.toString(), 'adx://foo.com/foo?foo=bar&baz=buux#hash')
  urip.hash = 'hash'
  t.is(urip.toString(), 'adx://foo.com/foo?foo=bar&baz=buux#hash')
})

test('Supports relative URIs', (t) => {
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
      t.is(urip.protocol, 'adx:')
      t.is(urip.host, basep.host)
      t.is(urip.hostname, basep.hostname)
      t.is(urip.origin, basep.origin)
      t.is(urip.pathname, pathname)
      t.is(urip.search, search)
      t.is(urip.hash, hash)
    }
  }
})
