import { describe, expect, it } from 'vitest'
import type { LexiconRecordKey } from '../core.js'
import { Space, space } from './space.js'

describe('Space', () => {
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
})
