import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import type { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import { LexDefBuilder } from './lex-def-builder.js'

async function buildSource(doc: LexiconDocument): Promise<string> {
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile(`/${doc.id}.defs.ts`)
  const indexer: LexiconIndexer = {
    get: async () => doc,
  }
  await new LexDefBuilder({}, file, doc, indexer).build()
  return file.getFullText()
}

describe('LexDefBuilder', () => {
  it('emits a space def with its key first and a title option', async () => {
    const source = await buildSource({
      lexicon: 1,
      id: 'com.example.group',
      defs: {
        main: {
          type: 'space',
          key: 'any',
          title: 'Example Group',
          'title:lang': { fr: 'Groupe Exemple' },
          collections: ['com.example.post'],
        },
      },
    })

    expect(source).toContain('l.space("any", $nsid, [')
    expect(source).toContain('"title":"Example Group"')
    expect(source).toContain('"title:lang":{"fr":"Groupe Exemple"}')
  })

  it('emits a space def without options when it has no title', async () => {
    const source = await buildSource({
      lexicon: 1,
      id: 'com.example.group',
      defs: {
        main: {
          type: 'space',
          key: 'any',
          collections: ['com.example.post'],
        },
      },
    })

    expect(source).toContain('l.space("any", $nsid, ["com.example.post"], )')
    expect(source).not.toContain('"title"')
  })
})
