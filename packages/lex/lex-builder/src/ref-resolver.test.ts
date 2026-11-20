import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import type { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import { RefResolver } from './ref-resolver.js'

class DummyIndexer implements LexiconIndexer, AsyncIterable<LexiconDocument> {
  readonly docs: Map<string, LexiconDocument>

  constructor(docs: LexiconDocument[]) {
    this.docs = new Map(docs.map((doc) => [doc.id, doc]))
  }

  async get(id: string): Promise<LexiconDocument> {
    const doc = this.docs.get(id)
    if (!doc) {
      throw new Error(`Document not found: ${id}`)
    }
    return doc
  }

  async *[Symbol.asyncIterator]() {
    for (const doc of this.docs.values()) {
      yield doc
    }
  }
}

describe('RefResolver', () => {
  const docs: LexiconDocument[] = [
    {
      lexicon: 1,
      id: 'com.example.foo',
      defs: {
        main: { type: 'token' },
      },
    },
    {
      lexicon: 1,
      id: 'com.example.bar',
      defs: {
        main: { type: 'token' },
      },
    },
  ]

  it('uses default relative path for external refs', async () => {
    const project = new Project({ useInMemoryFileSystem: true })
    const file = project.createSourceFile('/com/example/foo.defs.ts')
    const indexer = new DummyIndexer(docs)
    const resolver = new RefResolver(docs[0], file, indexer, {})

    await resolver.resolve('com.example.bar#main')

    const imports = file.getImportDeclarations()
    expect(imports).toHaveLength(1)
    expect(imports[0].getModuleSpecifierValue()).toBe('./bar.defs.js')
  })

  it('resolves refs to a parent namespace', async () => {
    const project = new Project({ useInMemoryFileSystem: true })
    const file = project.createSourceFile('/com/example/foo/child.defs.ts')
    const childDoc: LexiconDocument = {
      lexicon: 1,
      id: 'com.example.foo.child',
      defs: {
        main: { type: 'token' },
      },
    }
    const indexer = new DummyIndexer([...docs, childDoc])
    const resolver = new RefResolver(childDoc, file, indexer, {})

    await resolver.resolve('com.example.foo#main')

    const imports = file.getImportDeclarations()
    expect(imports).toHaveLength(1)
    expect(imports[0].getModuleSpecifierValue()).toBe('../foo.defs.js')
  })

  it('resolves refs to a grandparent namespace without import extension', async () => {
    const project = new Project({ useInMemoryFileSystem: true })
    const file = project.createSourceFile(
      '/com/example/foo/child/grandchild.defs.ts',
    )
    const grandchildDoc: LexiconDocument = {
      lexicon: 1,
      id: 'com.example.foo.child.grandchild',
      defs: {
        main: { type: 'token' },
      },
    }
    const indexer = new DummyIndexer([...docs, grandchildDoc])
    const resolver = new RefResolver(grandchildDoc, file, indexer, {
      importExt: '',
    })

    await resolver.resolve('com.example.foo#main')

    const imports = file.getImportDeclarations()
    expect(imports).toHaveLength(1)
    expect(imports[0].getModuleSpecifierValue()).toBe('../../foo.defs')
  })

  it('uses custom moduleSpecifier when provided', async () => {
    const project = new Project({ useInMemoryFileSystem: true })
    const file = project.createSourceFile('/com/example/foo.defs.ts')
    const indexer = new DummyIndexer(docs)
    const resolver = new RefResolver(docs[0], file, indexer, {
      moduleSpecifier: (nsid) => `https://lex.example.com/${nsid}.ts`,
    })

    await resolver.resolve('com.example.bar#main')

    const imports = file.getImportDeclarations()
    expect(imports).toHaveLength(1)
    expect(imports[0].getModuleSpecifierValue()).toBe(
      'https://lex.example.com/com.example.bar.ts',
    )
  })
})
