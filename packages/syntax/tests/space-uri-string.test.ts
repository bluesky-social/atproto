import { describe, expect, test } from 'vitest'
import { InvalidSpaceUriError, SpaceUri, createSpaceUri } from '../src/index.js'

describe('SpaceUri', () => {
  describe('parses space + record URIs', () => {
    test('space URI', () => {
      const uri = new SpaceUri(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
      expect(uri.authorityDid).toBe('did:plc:asdf123')
      expect(uri.spaceType).toBe('com.example.group')
      expect(uri.skey).toBe('default')
      expect(uri.space).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
      expect(uri.authorDid).toBe('')
      expect(uri.collection).toBe('')
      expect(uri.rkey).toBe('')
    })

    test('full record URI', () => {
      const uri = new SpaceUri(
        'at://did:plc:asdf123/space/com.example.group/default/did:plc:user1/com.atproto.feed.post/abc123',
      )
      expect(uri.authorityDid).toBe('did:plc:asdf123')
      expect(uri.spaceType).toBe('com.example.group')
      expect(uri.skey).toBe('default')
      expect(uri.authorDid).toBe('did:plc:user1')
      expect(uri.collection).toBe('com.atproto.feed.post')
      expect(uri.rkey).toBe('abc123')
      // the space portion drops the record segments
      expect(uri.space).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
    })
  })

  describe('rejects non-space URIs', () => {
    test('missing space marker (public at-uri)', () => {
      expect(
        () => new SpaceUri('at://did:plc:asdf123/com.example.group/default'),
      ).toThrow(InvalidSpaceUriError)
    })

    test('missing type/skey', () => {
      expect(() => new SpaceUri('at://did:plc:asdf123/space')).toThrow(
        InvalidSpaceUriError,
      )
      expect(
        () => new SpaceUri('at://did:plc:asdf123/space/com.example.group'),
      ).toThrow(InvalidSpaceUriError)
    })

    test('authority must be a DID', () => {
      expect(
        () =>
          new SpaceUri('at://user.bsky.social/space/com.example.group/default'),
      ).toThrow()
    })
  })

  describe('createSpaceUri', () => {
    test('builds a space URI', () => {
      const uri = createSpaceUri(
        'did:plc:asdf123',
        'com.example.group',
        'default',
      )
      expect(uri.toString()).toBe(
        'at://did:plc:asdf123/space/com.example.group/default',
      )
    })

    test('builds a full record URI', () => {
      const uri = createSpaceUri(
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
      expect(new SpaceUri(uri).rkey).toBe('abc123')
    })
  })
})
