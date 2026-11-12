import { describe, expect, it } from 'vitest'
import type { LexiconDocument } from '@atproto/lex-document'
import { listDocumentNsidRefs } from './lexicon-document.js'

const spaceDoc: LexiconDocument = {
  lexicon: 1,
  id: 'com.example.group',
  defs: {
    main: {
      type: 'space',
      key: 'any',
      collections: ['com.example.post', 'com.example.comment'],
    },
  },
}

const permissionSetDoc: LexiconDocument = {
  lexicon: 1,
  id: 'com.example.access',
  defs: {
    main: {
      type: 'permission-set',
      permissions: [
        {
          type: 'permission',
          resource: 'rpc',
          lxm: ['com.example.getThing'],
          aud: '*',
        },
        {
          type: 'permission',
          resource: 'repo',
          collection: ['com.example.thing'],
        },
        {
          type: 'permission',
          resource: 'space',
          spaceType: 'com.example.group',
          collection: ['com.example.post'],
        },
      ],
    },
  },
}

const refsOf = (...args: Parameters<typeof listDocumentNsidRefs>) =>
  Array.from(listDocumentNsidRefs(...args), String)

describe(listDocumentNsidRefs, () => {
  describe('space definitions', () => {
    it('ignores the declared collections by default', () => {
      expect(refsOf(spaceDoc)).toEqual([])
    })

    it('lists the declared collections with includeScopeCollections', () => {
      expect(refsOf(spaceDoc, { includeScopeCollections: true })).toEqual([
        'com.example.post',
        'com.example.comment',
      ])
    })
  })

  describe('permission sets', () => {
    it('ignores the permissions by default', () => {
      expect(refsOf(permissionSetDoc)).toEqual([])
    })

    it('lists the space permission refs with includePermissionSpace', () => {
      expect(
        refsOf(permissionSetDoc, { includePermissionSpace: true }),
      ).toEqual(['com.example.group', 'com.example.post'])
    })

    it('applies each permission option to its own resource', () => {
      expect(refsOf(permissionSetDoc, { includePermissionRpc: true })).toEqual([
        'com.example.getThing',
      ])
      expect(refsOf(permissionSetDoc, { includePermissionRepo: true })).toEqual(
        ['com.example.thing'],
      )
    })
  })
})
