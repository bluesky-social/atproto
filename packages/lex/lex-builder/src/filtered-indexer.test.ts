import { describe, expect, it } from 'vitest'
import { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import { FilteredIndexer } from './filtered-indexer.js'

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

describe('FilteredIndexer', () => {
  const docs: LexiconDocument[] = [
    {
      lexicon: 1,
      id: 'com.example.alpha',
      defs: {},
    },
    {
      lexicon: 1,
      id: 'com.example.beta',
      defs: {},
    },
    {
      lexicon: 1,
      id: 'org.sample.gamma',
      defs: {},
    },
  ]

  it('yields only filtered documents', async () => {
    const indexer = new DummyIndexer(docs)
    const filter = (id: string) => id.startsWith('com.example.')
    const filteredIndexer = new FilteredIndexer(indexer, filter)

    const yieldedDocs = []
    for await (const doc of filteredIndexer) {
      yieldedDocs.push(doc)
    }

    expect(yieldedDocs).toHaveLength(2)
    expect(yieldedDocs.map((d) => d.id)).toEqual([
      'com.example.alpha',
      'com.example.beta',
    ])
  })

  it('bypasses filter for requested documents', async () => {
    const indexer = new DummyIndexer(docs)
    const filter = (id: string) => id.startsWith('com.example.')
    const filteredIndexer = new FilteredIndexer(indexer, filter)

    // Request a document that would normally be filtered out
    const requestedDoc = await filteredIndexer.get('org.sample.gamma')
    expect(requestedDoc.id).toBe('org.sample.gamma')

    const yieldedDocs = []
    for await (const doc of filteredIndexer) {
      yieldedDocs.push(doc)
    }

    expect(yieldedDocs).toHaveLength(3)
    expect(yieldedDocs.map((d) => d.id)).toEqual([
      'com.example.alpha',
      'com.example.beta',
      'org.sample.gamma',
    ])
  })
})
