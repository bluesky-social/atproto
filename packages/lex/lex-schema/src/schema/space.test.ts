import { describe, expect, expectTypeOf, it } from 'vitest'
import { SpaceRef } from '@atproto/syntax'
import type { LexiconRecordKey } from '../core.js'
import { Space, space } from './space.js'

describe(Space, () => {
  it('exposes its key, nsid, collections and options', () => {
    const collections = ['com.example.thread', 'com.example.reply'] as const
    const options = { title: 'Forum', 'title:lang': { es: 'Foro' } }
    const sp = space('any', 'com.example.forum', collections, options)

    expect(sp).toBeInstanceOf(Space)
    expect(sp).toMatchObject({
      key: 'any',
      nsid: 'com.example.forum',
      spaceType: 'com.example.forum',
      title: 'Forum',
      collections,
      options,
    })
    expect(space('any', 'com.example.forum', []).options).toEqual({})
  })

  it('infers the collections as a tuple of NSIDs', () => {
    const sp = space('any', 'com.example.forum', [
      'com.example.thread',
      'com.example.reply',
    ])
    expectTypeOf(sp.collections).toEqualTypeOf<
      readonly ['com.example.thread', 'com.example.reply']
    >()
  })

  it('rejects an invalid key type', () => {
    expect(() =>
      space('bogus' as LexiconRecordKey, 'com.example.group', []),
    ).toThrow('Invalid record key')
  })

  describe(Space.prototype.spaceRefFor, () => {
    it('defaults the skey of a literal key', () => {
      const sp = space('literal:self', 'com.example.group', [])
      expect(sp.spaceRefFor('did:example:123').toString()).toBe(
        'at://did:example:123/space/com.example.group/self',
      )
    })

    it('builds a ref with the given skey', () => {
      const sp = space('tid', 'com.example.group', [])
      expect(sp.spaceRefFor('did:example:123', '3jzfcijpj2z2a')).toEqual(
        new SpaceRef('did:example:123', 'com.example.group', '3jzfcijpj2z2a'),
      )
    })

    it('refuses an skey that does not match a literal key', () => {
      const sp = space('literal:self', 'com.example.group', [])
      // @ts-expect-error skey does not match literal key
      expect(() => sp.spaceRefFor('did:example:123', 'other')).toThrow(
        TypeError,
      )
    })

    it('requires an skey for a non-literal key', () => {
      const sp = space('any', 'com.example.group', [])
      // @ts-expect-error skey is required
      expect(() => sp.spaceRefFor('did:example:123')).toThrow(TypeError)
    })
  })

  describe(Space.prototype.isKey, () => {
    it.each([
      ['tid', '3jzfcijpj2z2a', 'self'],
      ['nsid', 'com.example.foo', '3jzfcijpj2z2a'],
      ['any', 'self', 'in/valid'],
      ['literal:self', 'self', 'other'],
    ] as const)('validates a %s key', (key, valid, invalid) => {
      const sp = space(key, 'com.example.group', [])
      expect(sp.isKey(valid)).toBe(true)
      expect(sp.isKey(invalid)).toBe(false)
      expect(sp.isKey(undefined)).toBe(false)
    })

    it('narrows the key type', () => {
      const sp = space('literal:self', 'com.example.group', [])
      const skey: string = 'self'
      if (sp.isKey(skey)) expectTypeOf(skey).toEqualTypeOf<'self'>()
    })
  })

  describe(Space.prototype.matchesRef, () => {
    const sp = space('tid', 'com.example.group', [])

    it('matches a ref to a space of this type, narrowing it', () => {
      const ref = new SpaceRef(
        'did:plc:abc',
        'com.example.group',
        '3jzfcijpj2z2a',
      )
      expect(sp.matchesRef(ref)).toBe(true)
      if (sp.matchesRef(ref)) {
        expectTypeOf(ref.spaceType).toEqualTypeOf<'com.example.group'>()
      }
    })

    it('rejects a ref to another space type', () => {
      const ref = new SpaceRef(
        'did:plc:abc',
        'com.example.other',
        '3jzfcijpj2z2a',
      )
      expect(sp.matchesRef(ref)).toBe(false)
    })

    it('rejects a ref with an invalid key', () => {
      const ref = new SpaceRef('did:plc:abc', 'com.example.group', 'self')
      expect(sp.matchesRef(ref)).toBe(false)
    })
  })
})
