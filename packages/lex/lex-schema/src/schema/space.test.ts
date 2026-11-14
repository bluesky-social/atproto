import { describe, expect, expectTypeOf, it } from 'vitest'
import { SpaceRef } from '@atproto/syntax'
import type { LexiconRecordKey } from '../core.js'
import { Space, space } from './space.js'

describe(Space, () => {
  describe('constructor', () => {
    it('creates a Space instance with all parameters', () => {
      const nsid = 'com.atmoboards.forum'
      const collections = [
        'com.atmoboards.thread',
        'com.atmoboards.reply',
      ] as const
      const options = {
        title: 'AtmoBoards Forum',
        'title:lang': { es: 'Foro AtmoBoards' },
      }

      const sp = space('any', nsid, collections, options)

      expect(sp).toBeInstanceOf(Space)
      expect(sp.key).toBe('any')
      expect(sp.nsid).toBe(nsid)
      expect(sp.title).toBe('AtmoBoards Forum')
      expect(sp.options['title:lang']?.es).toBe('Foro AtmoBoards')
      expect(sp.collections).toBe(collections)
      expect(sp.options).toBe(options)
    })

    it('accepts a space without options', () => {
      const sp = space('any', 'com.example.group', ['com.example.post'])
      expect(sp.title).toBeUndefined()
      expect(sp.options).toEqual({})
    })

    it('infers the collections as a tuple of NSIDs', () => {
      const sp = space(
        'any',
        'com.atmoboards.forum',
        ['com.atmoboards.thread', 'com.atmoboards.reply'],
        { title: 'AtmoBoards Forum' },
      )
      expectTypeOf(sp.collections).toEqualTypeOf<
        readonly ['com.atmoboards.thread', 'com.atmoboards.reply']
      >()
    })

    it('accepts an empty collections array', () => {
      const sp = space('any', 'com.example.group', [], {
        title: 'Example Group',
      })
      expect(sp.collections).toEqual([])
    })

    it('accepts a literal key type', () => {
      const sp = space('literal:self', 'com.example.group', [], {
        title: 'Example Group',
      })
      expect(sp.key).toBe('literal:self')
    })

    it('rejects an invalid key type', () => {
      expect(() =>
        space('bogus' as LexiconRecordKey, 'com.example.group', [], {
          title: 'Example Group',
        }),
      ).toThrow('Invalid record key')
    })
  })

  describe(Space.prototype.spaceRefFor, () => {
    it('provides a default skey for literal keys', () => {
      const sp = space('literal:self', 'com.example.group', [], {
        title: 'Example Group',
      })
      const ref = sp.spaceRefFor('did:example:123')
      expect(ref).toBeDefined()
    })

    it('throws an error if skey does not match literal key', () => {
      const sp = space('literal:self', 'com.example.group', [], {
        title: 'Example Group',
      })
      // @ts-expect-error skey does not match literal key
      expect(() => sp.spaceRefFor('did:example:123', 'other')).toThrow()
    })

    it('throws an error if skey is not provided and key is not a literal', () => {
      const sp = space('any', 'com.example.group', [], {
        title: 'Example Group',
      })
      // @ts-expect-error skey is not provided and key is not a literal
      expect(() => sp.spaceRefFor('did:example:123')).toThrow()
    })
  })

  describe(Space.prototype.isKey, () => {
    it('validates keys against the key type', () => {
      const tid = space('tid', 'com.example.group', [], { title: 'Group' })
      expect(tid.isKey('3jzfcijpj2z2a')).toBe(true)
      expect(tid.isKey('self')).toBe(false)
      expect(tid.isKey(undefined)).toBe(false)

      const nsid = space('nsid', 'com.example.group', [], { title: 'Group' })
      expect(nsid.isKey('com.example.foo')).toBe(true)
      expect(nsid.isKey('3jzfcijpj2z2a')).toBe(false)

      const any = space('any', 'com.example.group', [], { title: 'Group' })
      expect(any.isKey('self')).toBe(true)
      expect(any.isKey('in/valid')).toBe(false)

      const self = space('literal:self', 'com.example.group', [], {
        title: 'Group',
      })
      expect(self.isKey('self')).toBe(true)
      expect(self.isKey('other')).toBe(false)
      expect(self.isKey(undefined)).toBe(false)
    })

    it('narrows the key type', () => {
      const sp = space('literal:self', 'com.example.group', [], {
        title: 'Group',
      })
      const skey: string = 'self'
      if (sp.isKey(skey)) expectTypeOf(skey).toEqualTypeOf<'self'>()
    })
  })

  describe(Space.prototype.matchesRef, () => {
    const sp = space('tid', 'com.example.group', [], { title: 'Group' })

    it('matches refs to a space of this type', () => {
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

    it('rejects refs with another space type', () => {
      const ref = new SpaceRef(
        'did:plc:abc',
        'com.example.other',
        '3jzfcijpj2z2a',
      )
      expect(sp.matchesRef(ref)).toBe(false)
    })

    it('rejects refs with an invalid key', () => {
      const ref = new SpaceRef('did:plc:abc', 'com.example.group', 'self')
      expect(sp.matchesRef(ref)).toBe(false)
    })
  })
})
