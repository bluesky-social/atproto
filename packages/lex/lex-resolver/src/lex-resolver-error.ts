import { LexError } from '@atproto/lex-data'
import { type DidString, NSID, type NsidString } from '@atproto/syntax'

/**
 * Error class for lexicon resolution failures.
 *
 * This error is thrown when the {@link LexResolver} encounters issues during
 * the resolution process, such as DNS lookup failures, DID resolution errors,
 * invalid lexicon documents, or network failures.
 *
 * @example Catching resolution errors
 * ```typescript
 * import { LexResolver, LexResolverError } from '@atproto/lex-resolver'
 *
 * const resolver = new LexResolver({})
 *
 * try {
 *   const result = await resolver.get('com.example.myLexicon')
 * } catch (error) {
 *   if (error instanceof LexResolverError) {
 *     console.error(`Failed to resolve ${error.nsid}: ${error.description}`)
 *     // Access the original cause if available
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause)
 *     }
 *   }
 * }
 * ```
 *
 * @example Creating errors with the factory method
 * ```typescript
 * import { LexResolverError } from '@atproto/lex-resolver'
 *
 * // Create from string NSID
 * const error = LexResolverError.from(
 *   'com.example.myLexicon',
 *   'Custom error description'
 * )
 * ```
 */
export class LexResolverError extends LexError {
  name = 'LexResolverError'

  public readonly nsid: NSID

  /**
   * Creates a new LexResolverError instance.
   *
   * @param nsid - The NSID that failed to resolve
   * @param description - Human-readable description of the error. Defaults to
   *   a generic message if not provided.
   * @param options - Standard error options including `cause` for error chaining
   *
   * @example
   * ```typescript
   * import { NSID } from '@atproto/syntax'
   * import { LexResolverError } from '@atproto/lex-resolver'
   *
   * const nsid = NSID.from('com.example.myLexicon')
   * const error = new LexResolverError(
   *   nsid,
   *   'DNS lookup failed',
   *   { cause: originalError }
   * )
   * ```
   */
  constructor(
    /**
     * The NSID that failed to resolve.
     */
    nsid: NSID | NsidString,
    message = `Unable to resolve Lexicon schema ${nsid}`,
    options?: ErrorOptions,
  ) {
    super('LexiconResolutionFailure', message, options)
    this.nsid = typeof nsid === 'string' ? NSID.from(nsid) : nsid
  }
}

export class LexResolverRecordNotFoundError extends LexResolverError {
  name = 'LexResolverRecordNotFoundError'

  constructor(
    readonly did: DidString,
    nsid: NSID,
    options?: ErrorOptions,
  ) {
    super(nsid, `Lexicon schema ${nsid} not found in ${did} repo`, options)
  }
}
