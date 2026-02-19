import { LexError } from '@atproto/lex-data'
import { NSID } from '@atproto/syntax'

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
    public readonly nsid: NSID,
    /**
     * Human-readable description of what went wrong during resolution.
     */
    public readonly description = `Could not resolve Lexicon for NSID`,
    options?: ErrorOptions,
  ) {
    super('LexiconResolutionFailure', `${description} (${nsid})`, options)
  }

  /**
   * Factory method to create a LexResolverError from a string or NSID.
   *
   * This is a convenience method that handles the conversion of string NSIDs
   * to NSID objects automatically.
   *
   * @param nsid - The NSID as a string or NSID object
   * @param description - Optional human-readable description of the error
   * @returns A new LexResolverError instance
   *
   * @example
   * ```typescript
   * import { LexResolverError } from '@atproto/lex-resolver'
   *
   * // Create from string
   * const error1 = LexResolverError.from('com.example.myLexicon')
   *
   * // Create with description
   * const error2 = LexResolverError.from(
   *   'com.example.myLexicon',
   *   'Authority not found in DNS'
   * )
   * ```
   */
  static from(nsid: NSID | string, description?: string) {
    return new LexResolverError(
      typeof nsid === 'string' ? NSID.from(nsid) : nsid,
      description,
    )
  }
}
