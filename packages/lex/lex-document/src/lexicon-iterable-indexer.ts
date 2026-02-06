import { LexiconDocument } from './lexicon-document.js'
import { LexiconIndexer } from './lexicon-indexer.js'

/**
 * Lazily indexes Lexicon documents from an iterable source.
 *
 * This class implements `LexiconIndexer` by consuming documents from an
 * iterable (sync or async) and caching them for efficient retrieval.
 * Documents are indexed on-demand as they are requested or iterated over.
 *
 * @example
 * ```ts
 * // From an array of documents
 * const docs = [lexiconDoc1, lexiconDoc2, lexiconDoc3]
 * const indexer = new LexiconIterableIndexer(docs)
 *
 * // Documents are indexed lazily as requested
 * const doc = await indexer.get('com.example.post')
 * ```
 *
 * @example
 * ```ts
 * // From an async generator (e.g., reading from files)
 * async function* loadLexicons() {
 *   for (const file of lexiconFiles) {
 *     yield JSON.parse(await fs.readFile(file, 'utf8'))
 *   }
 * }
 *
 * await using indexer = new LexiconIterableIndexer(loadLexicons())
 * const schemas = await LexiconSchemaBuilder.buildAll(indexer)
 * ```
 */
export class LexiconIterableIndexer implements LexiconIndexer, AsyncDisposable {
  readonly #lexicons: Map<string, LexiconDocument> = new Map()
  readonly #iterator:
    | AsyncIterator<LexiconDocument, void, unknown>
    | Iterator<LexiconDocument, void, unknown>

  /**
   * Creates a new {@link LexiconIterableIndexer} from an iterable source.
   *
   * @param source - An iterable or async iterable of Lexicon documents.
   *   The iterator is consumed lazily as documents are requested.
   *
   * @example
   * ```ts
   * // Sync iterable (array, Set, Map.values(), etc.)
   * const indexer = new LexiconIterableIndexer(lexiconDocuments)
   *
   * // Async iterable (async generator, ReadableStream, etc.)
   * const indexer = new LexiconIterableIndexer(asyncLexiconStream)
   * ```
   */
  constructor(
    readonly source: AsyncIterable<LexiconDocument> | Iterable<LexiconDocument>,
  ) {
    this.#iterator =
      Symbol.asyncIterator in source
        ? source[Symbol.asyncIterator]()
        : source[Symbol.iterator]()
  }

  /**
   * Retrieves a Lexicon document by its NSID.
   *
   * If the document has already been indexed, it is returned from cache.
   * Otherwise, the source iterator is consumed until the document is found.
   *
   * @see {@link LexiconIndexer.get}
   */
  async get(id: string): Promise<LexiconDocument> {
    const cached = this.#lexicons.get(id)
    if (cached) return cached

    for await (const doc of this) {
      if (doc.id === id) return doc
    }

    throw Object.assign(new Error(`Lexicon ${id} not found`), {
      code: 'ENOENT',
    })
  }

  async *[Symbol.asyncIterator](): AsyncIterator<
    LexiconDocument,
    void,
    undefined
  > {
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
        await this.#iterator.throw?.(err)
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
