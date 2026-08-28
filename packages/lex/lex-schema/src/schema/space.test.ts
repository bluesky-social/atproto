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
        name: 'AtmoBoards Forum',
        'name:lang': { es: 'Foro AtmoBoards' },
      }

      const sp = space(nsid, 'any', collections, options)

      expect(sp).toBeInstanceOf(Space)
      expect(sp.nsid).toBe(nsid)
      expect(sp.key).toBe('any')
      expect(sp.options.name).toBe('AtmoBoards Forum')
      expect(sp.collections).toBe(collections)
      expect(sp.options).toBe(options)
    })

    it('creates a Space instance with no options', () => {
      const sp = space('com.example.group', 'tid', ['com.example.message'], {
        name: 'Example Group',
      })

      expect(sp).toBeInstanceOf(Space)
      expect(sp.nsid).toBe('com.example.group')
      expect(sp.key).toBe('tid')
      expect(sp.name).toBe('Example Group')
      expect(sp.collections).toEqual(['com.example.message'])
    })

    it('accepts an empty collections array', () => {
      const sp = space('com.example.group', 'any', [], {
        name: 'Example Group',
      })
      expect(sp.collections).toEqual([])
    })

    it('accepts a literal key type', () => {
      const sp = space('com.example.group', 'literal:self', [], {
        name: 'Example Group',
      })
      expect(sp.key).toBe('literal:self')
    })
  })
})
