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
  it('lists no refs from space definitions or permissions by default', () => {
    expect(refsOf(spaceDoc)).toEqual([])
    expect(refsOf(permissionSetDoc)).toEqual([])
  })

  it.each([
    {
      option: 'includeScopeCollections',
      doc: spaceDoc,
      refs: ['com.example.post', 'com.example.comment'],
    },
    {
      option: 'includePermissionRpc',
      doc: permissionSetDoc,
      refs: ['com.example.getThing'],
    },
    {
      option: 'includePermissionRepo',
      doc: permissionSetDoc,
      refs: ['com.example.thing'],
    },
    {
      option: 'includePermissionSpace',
      doc: permissionSetDoc,
      refs: ['com.example.group', 'com.example.post'],
    },
  ])('lists only the refs $option adds', ({ option, doc, refs }) => {
    expect(refsOf(doc, { [option]: true })).toEqual(refs)
  })
})
