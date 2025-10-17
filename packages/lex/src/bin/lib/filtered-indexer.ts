import { LexiconDoc, LexiconIndexer } from '../../doc/index.js'
import { Filter } from './filter.js'

/**
 * A lexicon indexer that filters documents based on a provided filter.
 *
 * If a document was filtered out but later requested via `get()`, the filter
 * will be bypassed for that document.
 */
export class FilteredIndexer implements LexiconIndexer, AsyncDisposable {
  readonly #returned = new Set<string>()

  constructor(
    readonly indexer: LexiconIndexer & AsyncIterable<LexiconDoc>,
    readonly filter: Filter,
  ) {}

  async get(id: string): Promise<LexiconDoc> {
    this.#returned.add(id)
    return this.indexer.get(id)
  }

  async *[Symbol.asyncIterator]() {
    const returned = new Set<string>()

    for await (const doc of this.indexer) {
      if (this.#returned.has(doc.id) || this.filter(doc.id)) {
        this.#returned.add(doc.id)
        returned.add(doc.id)
        yield doc
      }
    }

    // When we yield control back to the caller, there may be requests (.get())
    // for documents that were initially ignored (filtered out). We won't be
    // done iterating until every document that has been requested has been
    // yielded.

    let returnedAny: boolean
    do {
      returnedAny = false
      for (const id of this.#returned) {
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
