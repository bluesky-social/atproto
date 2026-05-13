import { describe, expect, test } from 'vitest'
import {
  InvalidSpaceUriError,
  assertSpaceUriString,
  isSpaceUriString,
} from '../src'

describe('custom cases', () => {
  describe('valid spec basics', () => {
    testValid('ats://did:plc:asdf123')
    testValid('ats://did:plc:asdf123/com.example.group')
    testValid('ats://did:plc:asdf123/com.example.group/default')
    testValid('ats://did:plc:asdf123/com.example.group/default/did:plc:user1')
    testValid(
      'ats://did:plc:asdf123/com.example.group/default/did:plc:user1/com.atproto.feed.post',
    )
    testValid(
      'ats://did:plc:asdf123/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
    )
  })

  describe('invalid spec basics', () => {
    testInvalid('a://did:plc:asdf123')
    testInvalid('ats//did:plc:asdf123')
    testInvalid('ats:/did:plc:asdf123')
    testInvalid('ats:///did:plc:asdf123')
    testInvalid('://did:plc:asdf123')
    testInvalid('//did:plc:asdf123')
    testInvalid('http://did:plc:asdf123')
    testInvalid('at://did:plc:asdf123') // ats, not at
    testInvalid(' ats://did:plc:asdf123')
    testInvalid('ats://did:plc:asdf123 ')
  })

  describe('authority must be a DID', () => {
    testInvalid('ats://user.bsky.social')
    testInvalid('ats://name')
    testInvalid('ats://')
    testInvalid('ats://did:plc:')
  })

  describe('strict path validation', () => {
    // spaceType must be a valid NSID
    testInvalid('ats://did:plc:asdf123/short')
    testInvalid('ats://did:plc:asdf123/12345.foo.bar')

    // userDid must be a valid DID
    testInvalid('ats://did:plc:asdf123/com.example.group/default/notadid')

    // collection must be a valid NSID
    testInvalid(
      'ats://did:plc:asdf123/com.example.group/default/did:plc:user1/short',
    )

    // rkey must be a valid record-key
    testInvalid(
      'ats://did:plc:asdf123/com.example.group/default/did:plc:user1/com.atproto.feed.post/bad rkey',
    )
  })

  describe('non-strict accepts loose path components', () => {
    testLoose('ats://did:plc:asdf123/short')
    testLoose('ats://did:plc:asdf123/com.example.group/default/notadid')
  })

  describe('disallowed characters', () => {
    testInvalid('ats://did:plc:asdf123/com.example.g$oup')
    testInvalid('ats://did:plc:asdf123/com.example.g oup/default')
  })

  describe('very long strings', () => {
    testInvalid(`ats://did:plc:${'a'.repeat(8200)}/com.example.group/default`)
  })
})

function testValid(value: string) {
  test(value, () => {
    expect(isSpaceUriString(value)).toBe(true)
    expect(isSpaceUriString(value, { strict: false })).toBe(true)
    expect(() => assertSpaceUriString(value)).not.toThrow()
    expect(() => assertSpaceUriString(value, { strict: false })).not.toThrow()
  })
}

function testInvalid(value: string) {
  test(value, () => {
    expect(isSpaceUriString(value)).toBe(false)
    expect(() => assertSpaceUriString(value)).toThrow(InvalidSpaceUriError)
  })
}

function testLoose(value: string) {
  test(value, () => {
    expect(isSpaceUriString(value)).toBe(false)
    expect(isSpaceUriString(value, { strict: false })).toBe(true)
    expect(() => assertSpaceUriString(value)).toThrow()
    expect(() => assertSpaceUriString(value, { strict: false })).not.toThrow()
  })
}
