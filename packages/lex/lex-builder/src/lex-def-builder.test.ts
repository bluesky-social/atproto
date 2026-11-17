import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import type {
  LexiconDocument,
  LexiconIndexer,
  MainLexiconDefinition,
} from '@atproto/lex-document'
import { LexDefBuilder } from './lex-def-builder.js'

async function buildMain(main: MainLexiconDefinition): Promise<string> {
  const doc: LexiconDocument = {
    lexicon: 1,
    id: 'com.example.group',
    defs: { main },
  }
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile(`/${doc.id}.defs.ts`)
  const indexer: LexiconIndexer = { get: async () => doc }
  await new LexDefBuilder({}, file, doc, indexer).build()
  return file.getFullText()
}

describe(LexDefBuilder, () => {
  it('emits a space def with its title options', async () => {
    const source = await buildMain({
      type: 'space',
      key: 'any',
      title: 'Example Group',
      'title:lang': { fr: 'Groupe Exemple' },
      collections: ['com.example.post'],
    })
    expect(source).toContain(
      'l.space("any", $nsid, ["com.example.post"], {"title":"Example Group","title:lang":{"fr":"Groupe Exemple"}})',
    )
  })

  it('emits a space def without options when it has no title', async () => {
    const source = await buildMain({
      type: 'space',
      key: 'any',
      collections: ['com.example.post'],
    })
    expect(source).toContain('l.space("any", $nsid, ["com.example.post"],')
    expect(source).not.toContain('"title"')
  })

  it('types a space-ref string as a SpaceRefString', async () => {
    const source = await buildMain({
      type: 'object',
      properties: { space: { type: 'string', format: 'space-ref' } },
    })
    expect(source).toContain('"space"?:l.SpaceRefString')
  })
})
