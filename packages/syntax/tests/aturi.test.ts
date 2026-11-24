import { describe, expect, it, test } from 'vitest'
import {
  AtUri,
  type DidString,
  InvalidAtUriError,
  InvalidDidError,
  InvalidNsidError,
  InvalidRecordKeyError,
  type NsidString,
  SpaceRef,
} from '../src/index.js'
import { readInteropFile } from './_utils.js'

describe(AtUri, () => {
  describe('valid interop', () => {
    test.each(readInteropFile(`aturi_syntax_valid.txt`))('%s', (value) => {
      expect(() => new AtUri(value)).not.toThrow()
    })
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
    test.each(TESTS)('%s', (input, host, path, search, hash) => {
      const urip = new AtUri(input)
      expect(urip.protocol).toBe('at:')
      expect(urip.host).toBe(host)
      expect(urip.hostname).toBe(host)
      expect(urip.origin).toBe(`at://${host}`)
      expect(urip.pathname).toBe(path)
      expect(urip.search).toBe(search)
      expect(urip.hash).toBe(hash)
    })
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

    describe.each(BASES)('%s', (base) => {
      test.each(TESTS)('%s', (input, path, search, hash) => {
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
    })
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

  describe('space URIs', () => {
    const SPACE = 'at:space/did:plc:asdf123/com.example.group/default'
    const RECORD = `${SPACE}/did:plc:user1/com.atproto.feed.post/abc123`

    it('reads the parts of a space ref', () => {
      expect(new AtUri(SPACE)).toMatchObject({
        isSpace: true,
        origin: 'at:space/did:plc:asdf123',
        spaceDid: 'did:plc:asdf123',
        spaceType: 'com.example.group',
        skey: 'default',
        authorDid: undefined,
        collection: '',
        rkey: '',
      })
    })

    it('reads the record part of a record URI', () => {
      expect(new AtUri(RECORD)).toMatchObject({
        isSpace: true,
        spaceDid: 'did:plc:asdf123',
        authorDid: 'did:plc:user1',
        collection: 'com.atproto.feed.post',
        rkey: 'abc123',
      })
    })

    it('has no space parts on a public URI', () => {
      expect(
        new AtUri('at://did:plc:asdf123/com.atproto.feed.post/abc'),
      ).toMatchObject({
        isSpace: false,
        authorDid: 'did:plc:asdf123',
        spaceDid: undefined,
        spaceType: undefined,
        skey: undefined,
      })
      expect(
        new AtUri('at://user.bsky.social/com.atproto.feed.post/abc').authorDid,
      ).toBeUndefined()
    })

    it('rejects invalid space parts', () => {
      for (const invalid of [
        'at:space/did:plc:asdf123/short/default',
        'at:space/did:plc:asdf123/com.example.group/..',
        `${SPACE}/user.bsky.social/com.atproto.feed.post/abc123`,
        `${SPACE}/did:plc:user1/short/abc123`,
        `${SPACE}/did:plc:user1/com.atproto.feed.post/..`,
        `${SPACE}?foo=bar`,
      ]) {
        expect(() => new AtUri(invalid)).toThrow(InvalidAtUriError)
      }
    })

    it('requires the space DID to be a DID', () => {
      expect(
        () => new AtUri('at:space/user.bsky.social/com.example.group/default'),
      ).toThrow()
      expect(
        () => new AtUri('at:space/did:plc/com.example.group/default'),
      ).toThrow(InvalidDidError)

      const uri = new AtUri(SPACE)
      expect(() => (uri.hostname = 'user.bsky.social')).toThrow(InvalidDidError)
      expect(uri.toString()).toBe(SPACE)
    })

    it('references only a space or a record in a space', () => {
      for (const invalid of [
        'at:space/did:plc:asdf123',
        'at:space/did:plc:asdf123/com.example.group',
        `${SPACE}/did:plc:user1`,
        `${SPACE}/did:plc:user1/com.atproto.feed.post`,
        `${RECORD}/extra`,
      ]) {
        expect(() => new AtUri(invalid)).toThrow(InvalidAtUriError)
      }
      expect(() => new AtUri('/com.example.group', new AtUri(SPACE))).toThrow(
        InvalidAtUriError,
      )
    })

    it('reads the `space` path segment as a public collection', () => {
      expect(
        new AtUri('at://did:plc:asdf123/space/com.example.group/default'),
      ).toMatchObject({
        isSpace: false,
        collection: 'space',
        spaceDid: undefined,
      })
    })

    it('keeps the space prefix when resolving a relative path', () => {
      const uri = new AtUri('/com.example.group/other', new AtUri(SPACE))
      expect(uri.isSpace).toBe(true)
      expect(uri.toString()).toBe(
        'at:space/did:plc:asdf123/com.example.group/other',
      )
    })

    it('sets the record part after the author', () => {
      const uri = new AtUri(RECORD)
      uri.collection = 'com.example.other'
      uri.rkey = 'xyz'
      expect(uri.toString()).toBe(
        `${SPACE}/did:plc:user1/com.example.other/xyz`,
      )
    })

    it('refuses to set a record part on a space ref', () => {
      const uri = new AtUri(SPACE)
      expect(() => (uri.collection = 'com.example.post')).toThrow(
        InvalidAtUriError,
      )
      expect(() => (uri.rkey = 'abc')).toThrow(InvalidAtUriError)
      expect(uri.toString()).toBe(SPACE)
    })
  })
})

describe(SpaceRef, () => {
  const SPACE = 'at:space/did:plc:asdf123/com.example.group/default'
  const RECORD = `${SPACE}/did:plc:user1/com.atproto.feed.post/abc123`

  it('parses a space ref', () => {
    const ref = SpaceRef.parse(SPACE)
    expect(ref).toMatchObject({
      spaceDid: 'did:plc:asdf123',
      spaceType: 'com.example.group',
      skey: 'default',
    })
    expect(ref.toString()).toBe(SPACE)
  })

  it('parses only a space ref', () => {
    expect(() => SpaceRef.parse(RECORD)).toThrow(InvalidAtUriError)
    expect(() =>
      SpaceRef.parse('at://did:plc:asdf123/com.atproto.feed.post/abc'),
    ).toThrow(InvalidAtUriError)
  })

  it('finds the space a record URI belongs to', () => {
    expect(SpaceRef.for(RECORD).toString()).toBe(SPACE)
  })

  describe('recordUri', () => {
    const ref = SpaceRef.parse(SPACE)

    it('builds the URI of a record in the space', () => {
      expect(
        ref
          .recordUri('did:plc:user1', 'com.atproto.feed.post', 'abc123')
          .toString(),
      ).toBe(RECORD)
    })

    it('validates its parts', () => {
      expect(() =>
        ref.recordUri(
          'user.bsky.social' as DidString,
          'com.atproto.feed.post',
          'abc123',
        ),
      ).toThrow(InvalidDidError)
      expect(() =>
        ref.recordUri('did:plc:user1', 'short' as NsidString, 'abc123'),
      ).toThrow(InvalidNsidError)
      expect(() =>
        ref.recordUri('did:plc:user1', 'com.atproto.feed.post', '..'),
      ).toThrow(InvalidRecordKeyError)
    })
  })
})
