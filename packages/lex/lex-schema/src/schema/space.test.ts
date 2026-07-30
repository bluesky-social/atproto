import { describe, expect, it } from 'vitest'
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
        description: 'A discussion forum',
        'name:lang': { es: 'Foro AtmoBoards' },
      }

      const sp = space(nsid, 'any', 'AtmoBoards Forum', collections, options)

      expect(sp).toBeInstanceOf(Space)
      expect(sp.nsid).toBe(nsid)
      expect(sp.key).toBe('any')
      expect(sp.name).toBe('AtmoBoards Forum')
      expect(sp.collections).toBe(collections)
      expect(sp.options).toBe(options)
    })

    it('creates a Space instance with no options', () => {
      const sp = space('com.example.group', 'tid', 'Example Group', [
        'com.example.message',
      ])

      expect(sp).toBeInstanceOf(Space)
      expect(sp.nsid).toBe('com.example.group')
      expect(sp.key).toBe('tid')
      expect(sp.name).toBe('Example Group')
      expect(sp.collections).toEqual(['com.example.message'])
      expect(sp.options).toEqual({})
    })

    it('accepts an empty collections array', () => {
      const sp = space('com.example.group', 'any', 'Example Group', [])
      expect(sp.collections).toEqual([])
    })

    it('accepts a literal key type', () => {
      const sp = space('com.example.group', 'literal:self', 'Example Group', [])
      expect(sp.key).toBe('literal:self')
    })
  })
})
