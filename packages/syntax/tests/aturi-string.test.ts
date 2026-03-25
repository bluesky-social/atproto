import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { InvalidAtUriError, assertAtUriString, isAtUriString } from '../src'

describe('valid interop', () => {
  for (const value of readLines(
    `${__dirname}/../../../interop-test-files/syntax/aturi_syntax_valid.txt`,
  )) {
    testValid(value)
  }
})

describe('invalid interop', () => {
  for (const value of readLines(
    `${__dirname}/../../../interop-test-files/syntax/aturi_syntax_invalid.txt`,
  )) {
    testInvalid(value)
  }
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
