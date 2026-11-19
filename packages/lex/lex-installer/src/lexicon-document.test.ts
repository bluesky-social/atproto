import { describe, expect, it } from 'vitest'
import type { LexiconDocument } from '@atproto/lex-document'
import { listDocumentNsidRefs } from './lexicon-document.js'

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
      ],
    },
  },
}

const refsOf = (...args: Parameters<typeof listDocumentNsidRefs>) =>
  Array.from(listDocumentNsidRefs(...args), String)

describe(listDocumentNsidRefs, () => {
  it('lists no refs from permissions by default', () => {
    expect(refsOf(permissionSetDoc)).toEqual([])
  })

  it.each([
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
  ])('lists only the refs $option adds', ({ option, doc, refs }) => {
    expect(refsOf(doc, { [option]: true })).toEqual(refs)
  })
})
