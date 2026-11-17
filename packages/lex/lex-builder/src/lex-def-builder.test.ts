import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import type {
  LexiconDocument,
  LexiconIndexer,
  MainLexiconDefinition,
} from '@atproto/lex-document'
import { LexDefBuilder } from './lex-def-builder.js'

const postDoc: LexiconDocument = {
  lexicon: 1,
  id: 'com.example.post',
  defs: {
    main: {
      type: 'record',
      key: 'tid',
      record: { type: 'object', properties: {} },
    },
  },
}

const viewDoc: LexiconDocument = {
  lexicon: 1,
  id: 'com.example.view',
  defs: { main: { type: 'object', properties: {} } },
}

async function buildMain(main: MainLexiconDefinition): Promise<string> {
  const doc: LexiconDocument = {
    lexicon: 1,
    id: 'com.example.group',
    defs: { main },
  }
  const docs = new Map<string, LexiconDocument>(
    [doc, postDoc, viewDoc].map((d) => [d.id, d]),
  )
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile(`/${doc.id}.defs.ts`)
  const indexer: LexiconIndexer = {
    get: async (nsid) => {
      const found = docs.get(nsid)
      if (!found) throw new Error(`Lexicon ${nsid} not found`)
      return found
    },
  }
  await new LexDefBuilder({}, file, doc, indexer).build()
  return file.getFullText()
}

describe(LexDefBuilder, () => {
  it('emits a space def without its title', async () => {
    const source = await buildMain({
      type: 'space',
      key: 'any',
      title: 'Example Group',
      'title:lang': { fr: 'Groupe Exemple' },
      collections: ['com.example.post'],
    })
    expect(source).toContain(
      'l.space("any", $nsid, [/*#__PURE__*/ l.typedRef(() => ExamplePost.main)])',
    )
    expect(source).not.toContain('title')
  })

  it('references the record schemas of the space collections', async () => {
    const source = await buildMain({
      type: 'space',
      key: 'any',
      collections: ['com.example.post'],
    })
    expect(source).toContain(
      'import * as ExamplePost from "./com/example/post.defs.js"',
    )
    expect(source).toContain('l.typedRef(() => ExamplePost.main)')
  })

  it.each([
    ['is not a record', 'com.example.view'],
    ['is the space itself', 'com.example.group'],
  ] as const)('rejects a space collection that %s', async (_, nsid) => {
    await expect(
      buildMain({ type: 'space', key: 'any', collections: [nsid] }),
    ).rejects.toThrow(
      `Collection ${nsid} of space com.example.group is not a record`,
    )
  })

  it('types a space-ref string as a SpaceRefString', async () => {
    const source = await buildMain({
      type: 'object',
      properties: { space: { type: 'string', format: 'space-ref' } },
    })
    expect(source).toContain('"space"?:l.SpaceRefString')
  })
})
