import { LexiconDocument } from './lexicon-document.js'

/**
 * Interface for indexing and retrieving Lexicon documents by their NSID.
 *
 * @example
 * ```ts
 * // Using a custom indexer implementation
 * const networkIndexer: LexiconIndexer = {
 *   async get(nsid: string) {
 *     const doc = await resolveLexicon(nsid)
 *     return doc
 *   }
 * }
 *
 * const validator = await LexiconSchemaBuilder.build(networkIndexer, 'com.example.post#main')
 * ```
 */
export interface LexiconIndexer {
  /**
   * Retrieves a Lexicon document by its NSID.
   *
   * @param nsid - The Namespaced Identifier of the Lexicon document to retrieve
   * @returns A promise that resolves to the Lexicon document
   * @throws When the document with the given NSID cannot be found
   *
   * @example
   * ```ts
   * const doc = await indexer.get('com.atproto.repo.createRecord')
   * console.log(doc.defs.main?.type) // 'procedure'
   * ```
   */
  get(nsid: string): Promise<LexiconDocument>

  /**
   * Optional async disposal method for cleanup.
   *
   * When implemented, allows the indexer to be used with `await using`
   * syntax for automatic resource cleanup.
   *
   * @returns A promise that resolves when disposal is complete
   */
  [Symbol.asyncDispose]?: () => Promise<void>

  /**
   * Optional async iterator for iterating over all available Lexicon documents.
   *
   * @returns An async iterator yielding Lexicon documents
   *
   * @example
   * ```ts
   * if (Symbol.asyncIterator in indexer) {
   *   for await (const doc of indexer) {
   *     console.log(doc.id)
   *   }
   * }
   * ```
   */
  [Symbol.asyncIterator]?: () => AsyncIterator<LexiconDocument, void, unknown>
}
