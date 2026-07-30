import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  AtUri,
  InvalidAtUriError,
  assertAtUriString,
  isAtUriString,
  isPublicAtUriString,
  isSpaceAtUriString,
  isSpaceUri,
  parseAtUriString,
} from '../src/index.js'

describe('valid interop', () => {
  test.each(
    readLines(
      `${__dirname}/../../../interop-test-files/syntax/aturi_syntax_valid.txt`,
    ),
  )('%s', (value) => {
    expect(isAtUriString(value)).toBe(true)
    expect(isAtUriString(value, { strict: false })).toBe(true)
    expect(() => assertAtUriString(value)).not.toThrow()
    expect(() => assertAtUriString(value, { strict: false })).not.toThrow()
  })
})

describe('invalid interop', () => {
  test.each(
    readLines(
      `${__dirname}/../../../interop-test-files/syntax/aturi_syntax_invalid.txt`,
    ),
  )('%s', (value) => {
    expect(isAtUriString(value)).toBe(false)
    expect(() => assertAtUriString(value)).toThrow(InvalidAtUriError)
  })
})

describe('custom cases', () => {
  describe('valid spec basics', () => {
    testValid('at://did:plc:asdf123')
    testValid('at://user.bsky.social')
    testValid('at://did:plc:asdf123/com.atproto.feed.post')
    testValid('at://did:plc:asdf123/com.atproto.feed.post/record')

    testValid('at://did:plc:asdf123#/frag')
    testValid('at://user.bsky.social#/frag')
    testValid('at://did:plc:asdf123/com.atproto.feed.post#/frag')
    testValid('at://did:plc:asdf123/com.atproto.feed.post/record#/frag')
  })

  describe('invalid spec basics', () => {
    testInvalid('a://did:plc:asdf123')
    testInvalid('at//did:plc:asdf123')
    testInvalid('at:/a/did:plc:asdf123')
    testInvalid('at:/did:plc:asdf123')
    testInvalid('AT://did:plc:asdf123')
    testInvalid('http://did:plc:asdf123')
    testInvalid('://did:plc:asdf123')
    testInvalid('at:did:plc:asdf123')
    testInvalid('at:/did:plc:asdf123')
    testInvalid('at:///did:plc:asdf123')
    testInvalid('at://:/did:plc:asdf123')
    testInvalid('at:/ /did:plc:asdf123')
    testInvalid('at://did:plc:asdf123 ')
    testInvalid('at://did:plc:asdf123/ ')
    testInvalid(' at://did:plc:asdf123')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post ')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post# ')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post#/ ')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post#/frag ')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post#fr ag')
    testInvalid('//did:plc:asdf123')
    testInvalid('at://name')
    testInvalid('at://name.0')
    testInvalid('at://diD:plc:asdf123')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.p@st')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.p$st')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.p%st')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.p&st')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.p()t')
    testInvalid('at://did:plc:asdf123/com.atproto.feed_post')
    testInvalid('at://did:plc:asdf123/-com.atproto.feed.post')
    testInvalid('at://did:plc:asdf@123/com.atproto.feed.post')

    testInvalid('at://did:plc:asdf123?a')
    testInvalid('at://user.bsky.social?a=B')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post?foo=bar')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/record?q=3')

    testInvalid('at://did:plc:asdf123?a=b#/frag')
    testInvalid('at://user.bsky.social?a=b#/frag')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post?a=b#/frag')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/record?a=b#/frag')

    testInvalid('at://DID:plc:asdf123')
    testInvalid('at://user.bsky.123')
    testInvalid('at://bsky')
    testInvalid('at://did:plc:')
    testInvalid('at://did:plc:')
    testInvalid('at://frag')
  })

  describe('very long strings', () => {
    testValid('at://did:plc:asdf123/com.atproto.feed.post/' + 'o'.repeat(512))
    testValid(`at://did:web:x${'.y'.repeat(100)}/com.atproto.feed.post/record`)
    testInvalid(`at://did:plc:${'o'.repeat(8200)}/com.atproto.feed.post/record`)
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/' + 'o'.repeat(513))
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/' + 'o'.repeat(800))
  })

  describe('invalid collection', () => {
    testInvalid('at://did:plc:asdf123/short/stuff')
    testInvalid('at://did:plc:asdf123/12345')
  })

  describe('invalid repeated slashes', () => {
    testInvalid('at://user.bsky.social//')
    testInvalid('at://user.bsky.social//com.atproto.feed.post')
    testInvalid('at://user.bsky.social/com.atproto.feed.post//')
  })

  describe('invalid trailing slashes', () => {
    testInvalid('at://did:plc:asdf123/')
    testInvalid('at://user.bsky.social/')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/record/')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/record/#/frag')
  })

  describe('invalid segment count', () => {
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/asdf123/asdf')
    testInvalid('at://did:plc:asdf123/com.atproto.feed.post/asdf123/more/more')
  })

  describe('valid record key', () => {
    testValid('at://did:plc:asdf123/com.atproto.feed.post/a')
    testValid('at://did:plc:asdf123/com.atproto.feed.post/asdf123')
  })

  describe('loosely valid trailing slash', () => {
    testLoose('at://did:plc:asdf123/')
    testLoose('at://user.bsky.social/')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/record/')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/record/#/frag')
  })

  describe('loosely valid record keys', () => {
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%23')

    testLoose('at://did:plc:asdf123/com.atproto.feed.post/$@!*)(:,;~.sdf123')
    testLoose("at://did:plc:asdf123/com.atproto.feed.post/~'sdf123")

    testLoose('at://did:plc:asdf123/com.atproto.feed.post/$')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/@')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/!')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/*')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/(')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/,')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/;')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/abc%30123')

    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%30')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%3')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%zz')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/%%%')

    testLoose('at://did:plc:asdf123/com.atproto.feed.post/[]')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/foo[')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/bar]')
    testLoose('at://did:plc:asdf123/com.atproto.feed.post/[baz]')
  })

  describe('valid fragment', () => {
    testValid('at://did:plc:asdf123#/frac')
  })

  describe('invalid fragment', () => {
    testValid('at://did:plc:asdf123#/com.atproto.feed.post')
    testValid('at://did:plc:asdf123#/com.atproto.feed.post/')
    testValid('at://did:plc:asdf123#/asdf/')

    testValid('at://did:plc:asdf123/com.atproto.feed.post#/$@!*():,;~.sdf123')
    testValid('at://did:plc:asdf123#/[asfd]')

    testValid('at://did:plc:asdf123#/$')
    testValid('at://did:plc:asdf123#/*')
    testValid('at://did:plc:asdf123#/;')
    testValid('at://did:plc:asdf123#/,')

    testInvalid('at://did:plc:asdf123#')
    testInvalid('at://did:plc:asdf123##')
    testInvalid('#at://did:plc:asdf123')
    testInvalid('at://did:plc:asdf123#/asdf#/asdf')
  })

  // Permissioned space URIs reuse the at:// scheme with a `space` marker and
  // extra path segments (proposal 0016).
  describe('space URIs', () => {
    // space reference (authority/space/type/skey)
    testValid('at://did:plc:asdf123/space/com.example.group/default')
    // full record (…/author/collection/rkey)
    testValid(
      'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
    )

    // spaceType must be an NSID
    testInvalid('at://did:plc:asdf123/space/short/default')
    // authority must be an at-identifier
    testInvalid('at://not a did/space/com.example.group/default')
    // spaces are keyed on DIDs — a handle authority is not allowed, even though
    // it is on a public uri
    testInvalid('at://user.bsky.social/space/com.example.group/default')
    // ...nor is a handle author
    testInvalid(
      'at://did:plc:asdf123/space/com.example.group/default/user.bsky.social/com.atproto.feed.post/abc123',
    )
    // missing skey
    testInvalid('at://did:plc:asdf123/space/com.example.group')
    // bare marker
    testInvalid('at://did:plc:asdf123/space')
    // partial record tail (author without collection/rkey)
    testInvalid(
      'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1',
    )
    // record with non-NSID collection
    testInvalid(
      'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/short/abc123',
    )

    // strict enforces NSID spaceType; lenient still requires the shape but
    // relaxes the record key
    testLoose(
      'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/%%%',
    )

    // fragments are allowed, as on a public uri
    testValid('at://did:plc:asdf123/space/com.example.group/default#/frag')
    testValid(
      'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc#/frag',
    )
    testInvalid('at://did:plc:asdf123/space/com.example.group/default#')
    testInvalid('at://did:plc:asdf123/space/com.example.group/default#/a#/b')

    // ...and query and trailing slash are rejected, also as on a public uri
    testLoose('at://did:plc:asdf123/space/com.example.group/default?foo=bar')
    testLoose('at://did:plc:asdf123/space/com.example.group/default/')
  })

  describe('discriminating space from public', () => {
    const SPACE = 'at://did:plc:asdf123/space/com.example.group/default'
    const PUBLIC = 'at://did:plc:asdf123/com.atproto.feed.post/abc'

    test('isSpaceUri checks only for the marker', () => {
      expect(isSpaceUri(SPACE)).toBe(true)
      expect(isSpaceUri(PUBLIC)).toBe(false)
      expect(isSpaceUri('at://did:plc:asdf123')).toBe(false)
      expect(isSpaceUri('at://did:plc:asdf123/spacey/x/y')).toBe(false)
      expect(isSpaceUri(null)).toBe(false)
      expect(isSpaceUri(42)).toBe(false)
    })

    test('isSpaceAtUriString / isPublicAtUriString also validate', () => {
      expect(isSpaceAtUriString(SPACE)).toBe(true)
      expect(isPublicAtUriString(SPACE)).toBe(false)

      expect(isPublicAtUriString(PUBLIC)).toBe(true)
      expect(isSpaceAtUriString(PUBLIC)).toBe(false)

      // unlike isSpaceUri, these reject anything that isn't a valid aturi
      expect(isPublicAtUriString('hello')).toBe(false)
      expect(isSpaceAtUriString('at://did:plc:asdf123/space')).toBe(false)
    })

    test('parseAtUriString discriminates on isSpace', () => {
      const pub = parseAtUriString(PUBLIC)
      expect(pub.success && pub.value.isSpace).toBe(false)

      const space = parseAtUriString(
        `${SPACE}/did:plc:user1/com.atproto.feed.post/abc123`,
      )
      if (!space.success || !space.value.isSpace) {
        throw new Error('expected a space uri')
      }
      expect(space.value.authority).toBe('did:plc:asdf123')
      expect(space.value.spaceType).toBe('com.example.group')
      expect(space.value.skey).toBe('default')
      expect(space.value.author).toBe('did:plc:user1')
      expect(space.value.collection).toBe('com.atproto.feed.post')
      expect(space.value.rkey).toBe('abc123')
    })

    test('isSpace', () => {
      expect(
        new AtUri('at://did:plc:asdf123/space/com.example.group/default')
          .isSpace,
      ).toBe(true)
      expect(
        new AtUri('at://did:plc:asdf123/com.atproto.feed.post/abc').isSpace,
      ).toBe(false)
      expect(new AtUri('at://did:plc:asdf123').isSpace).toBe(false)
    })
  })

  // collection/rkey/authorDid name the record, so they read the same way for
  // both kinds of uri.
  describe('reading a record', () => {
    test('from a public uri', () => {
      const uri = new AtUri('at://did:plc:asdf123/com.atproto.feed.post/abc123')
      expect(uri.authorDid).toBe('did:plc:asdf123')
      expect(uri.collection).toBe('com.atproto.feed.post')
      expect(uri.rkey).toBe('abc123')
      // did is deprecated but unchanged
      expect(uri.did).toBe('did:plc:asdf123')
    })

    test('from a space uri', () => {
      const uri = new AtUri(
        'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
      )
      // not 'space' — the record's actual collection
      expect(uri.collection).toBe('com.atproto.feed.post')
      expect(uri.rkey).toBe('abc123')
      // the record's author, not the space's authority
      expect(uri.authorDid).toBe('did:plc:user1')
    })

    test('a space uri with no record path names no record', () => {
      const uri = new AtUri(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
      expect(uri.collection).toBe('')
      expect(uri.rkey).toBe('')
      expect(uri.authorDid).toBeUndefined()
    })

    test('a public uri with a handle authority has no author did', () => {
      const uri = new AtUri('at://user.bsky.social/com.atproto.feed.post/abc')
      expect(uri.authorDid).toBeUndefined()
      expect(uri.collection).toBe('com.atproto.feed.post')
    })
  })

  describe('reading a space', () => {
    test('exposes the space parts', () => {
      const uri = new AtUri(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
      expect(uri.spaceDid).toBe('did:plc:asdf123')
      expect(uri.spaceType).toBe('com.example.group')
      expect(uri.skey).toBe('default')
      expect(uri.space).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
    })

    test('a record uri still names its space', () => {
      const uri = new AtUri(
        'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
      )
      expect(uri.spaceDid).toBe('did:plc:asdf123')
      expect(uri.space).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
    })

    test('space accessors are undefined on a public uri', () => {
      const uri = new AtUri('at://did:plc:asdf123/com.atproto.feed.post/abc')
      expect(uri.spaceDid).toBeUndefined()
      expect(uri.space).toBeUndefined()
      expect(uri.spaceType).toBeUndefined()
      expect(uri.skey).toBeUndefined()
    })
  })

  describe('AtUri.makeSpace', () => {
    test('builds a space uri', () => {
      const uri = AtUri.makeSpace(
        'did:plc:asdf123',
        'com.example.group',
        'default',
      )
      expect(uri.toString()).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
      expect(uri.skey).toBe('default')
    })

    test('builds a record uri', () => {
      const uri = AtUri.makeSpace(
        'did:plc:asdf123',
        'com.example.group',
        'default',
        'did:plc:user1',
        'com.atproto.feed.post',
        'abc123',
      )
      expect(uri.toString()).toBe(
        'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
      )
      expect(uri.authorDid).toBe('did:plc:user1')
      expect(uri.rkey).toBe('abc123')
    })
  })
})

function testValid(value: string) {
  test(value, () => {
    expect(isAtUriString(value)).toBe(true)
    expect(isAtUriString(value, { strict: false })).toBe(true)
    expect(() => assertAtUriString(value)).not.toThrow()
    expect(() => assertAtUriString(value, { strict: false })).not.toThrow()
  })
}

function testInvalid(value: string) {
  test(value, () => {
    expect(isAtUriString(value)).toBe(false)
    expect(() => assertAtUriString(value)).toThrow(InvalidAtUriError)
  })
}

function testLoose(value: string) {
  test(value, () => {
    expect(isAtUriString(value)).toBe(false)
    expect(isAtUriString(value, { strict: false })).toBe(true)
    expect(() => assertAtUriString(value)).toThrow()
    expect(() => assertAtUriString(value, { strict: false })).not.toThrow()
  })
}

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
