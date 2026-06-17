import { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import { Filter } from './filter.js'

/**
 * A lexicon indexer that filters documents based on a provided filter.
 *
 * If a document was filtered out but later requested via `get()`, the filter
 * will be bypassed for that document.
 */
export class FilteredIndexer implements LexiconIndexer, AsyncDisposable {
  protected readonly returned = new Set<string>()

  constructor(
    readonly indexer: LexiconIndexer & AsyncIterable<LexiconDocument>,
    readonly filter: Filter,
  ) {}

  async get(id: string): Promise<LexiconDocument> {
    this.returned.add(id)
    return this.indexer.get(id)
  }

  async *[Symbol.asyncIterator]() {
    const returned = new Set<string>()

    for await (const doc of this.indexer) {
      if (returned.has(doc.id)) {
        // Should never happen
        throw new Error(`Duplicate lexicon document id: ${doc.id}`)
      }

      if (this.returned.has(doc.id) || this.filter(doc.id)) {
        this.returned.add(doc.id)
        returned.add(doc.id)
        yield doc
      }
    }

    // When we yield control back to the caller, there may be requests (.get())
    // for documents that were initially ignored (filtered out). We won't be
    // done iterating until every document that may have been requested when the
    // control was yielded to the caller has been returned.

    let returnedAny: boolean
    do {
      returnedAny = false
      for (const id of this.returned) {
        if (!returned.has(id)) {
          yield await this.indexer.get(id)
          returned.add(id)
          returnedAny = true
        }
      }
    } while (returnedAny)
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.indexer[Symbol.asyncDispose]?.()
  }
}
