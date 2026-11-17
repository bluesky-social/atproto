import { describe, expect, expectTypeOf, it } from 'vitest'
import { SpaceRef } from '@atproto/syntax'
import type { LexiconRecordKey } from '../core.js'
import { object } from './object.js'
import { record } from './record.js'
import { Space, space } from './space.js'
import { typedObject } from './typed-object.js'
import { typedRef } from './typed-ref.js'

const thread = record('tid', 'com.example.thread', object({}))
const reply = record('tid', 'com.example.reply', object({}))
const post = record('tid', 'com.example.post', object({}))

describe(Space, () => {
  it('exposes its key, nsid, collections and options', () => {
    const options = { title: 'Forum', 'title:lang': { es: 'Foro' } }
    const sp = space('any', 'com.example.forum', [thread, reply], options)

    expect(sp).toBeInstanceOf(Space)
    expect(sp).toMatchObject({
      key: 'any',
      nsid: 'com.example.forum',
      spaceType: 'com.example.forum',
      title: 'Forum',
      collections: [thread, reply],
      options,
    })
    expect(space('any', 'com.example.forum', []).options).toEqual({})
  })

  it('resolves the record schemas of its collections', () => {
    const sp = space('any', 'com.example.forum', [thread, reply, post])
    expect(sp.collections).toEqual([thread, reply, post])
    expect(sp.collections).toBe(sp.collections)
    expectTypeOf(sp.collections).toEqualTypeOf<
      readonly (typeof thread | typeof reply | typeof post)[]
    >()
  })

  it('resolves references lazily', () => {
    const sp = space('any', 'com.example.forum', [typedRef(() => later)])
    const later = record('tid', 'com.example.later', object({}))
    expect(sp.collections).toEqual([later])
    expectTypeOf(sp.collections).toEqualTypeOf<readonly (typeof later)[]>()
  })

  it('infers no collections from an empty list', () => {
    const sp = space('any', 'com.example.forum', [])
    expectTypeOf(sp.collections).toEqualTypeOf<readonly never[]>()
  })

  it('only accepts record schemas as collections', () => {
    const view = typedObject('com.example.thread', 'view', object({}))
    // @ts-expect-error not a record schema
    space('any', 'com.example.forum', [view])
    // @ts-expect-error not a record schema
    space('any', 'com.example.forum', [typedRef(() => view)])
    // @ts-expect-error not a record schema
    space('any', 'com.example.forum', ['com.example.thread'])
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
