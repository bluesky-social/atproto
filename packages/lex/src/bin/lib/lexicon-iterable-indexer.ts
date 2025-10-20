import { LexiconDoc, LexiconIndexer } from '../../doc/index.js'

/**
 * (Lazily) indexes lexicon documents from an iterable source.
 */
export class LexiconIterableIndexer implements LexiconIndexer, AsyncDisposable {
  readonly #lexicons: Map<string, LexiconDoc> = new Map()
  readonly #iterator:
    | AsyncIterator<LexiconDoc, void, unknown>
    | Iterator<LexiconDoc, void, unknown>

  constructor(
    readonly source: AsyncIterable<LexiconDoc> | Iterable<LexiconDoc>,
  ) {
    this.#iterator =
      Symbol.asyncIterator in source
        ? source[Symbol.asyncIterator]()
        : source[Symbol.iterator]()
  }

  async get(id: string): Promise<LexiconDoc> {
    const cached = this.#lexicons.get(id)
    if (cached) return cached

    for await (const doc of this) {
      if (doc.id === id) return doc
    }

    throw new Error(`Lexicon ${id} not found`)
  }

  async *[Symbol.asyncIterator](): AsyncIterator<LexiconDoc, void, undefined> {
    const returned = new Set<string>()

    for (const doc of this.#lexicons.values()) {
      returned.add(doc.id)
      yield doc
    }

    do {
      const { value, done } = await this.#iterator.next()

      if (done) break

      if (returned.has(value.id)) {
        const err = new Error(`Duplicate lexicon document id: ${value.id}`)
        this.#iterator.throw?.(err)
        throw err // In case iterator.throw does not exist or does not throw
      }

      this.#lexicons.set(value.id, value)
      returned.add(value.id)
      yield value
    } while (true)

    // At this point, the underlying iterator is done. However, there may have
    // been requests (.get()) for documents that caused the iterator to yield
    // those documents during concurrent execution of this loop. If that was the
    // case, new documents may have been added to `#lexicons` that have not yet
    // been yielded. We need to yield those as well. Since we yield control back
    // to the caller, we need to repeat this process until no new documents
    // appear sunce we don't know what happens.

    for (const doc of this.#lexicons.values()) {
      if (!returned.has(doc.id)) {
        returned.add(doc.id)
        yield doc
      }
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#iterator.return?.()
  }
}
