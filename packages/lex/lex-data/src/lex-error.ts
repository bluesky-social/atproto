import { hasPropOfType } from './lib/object.js'

const kLexError = Symbol.for('@atproto/lex-data/LexError')

/**
 * Error code type for Lexicon errors.
 *
 * Error codes identify the type of error that occurred (e.g., 'InvalidRequest').
 *
 * @example
 * ```typescript
 * import type { LexErrorCode } from '@atproto/lex-data'
 *
 * const errorCode: LexErrorCode = 'InvalidRequest'
 * ```
 */
export type LexErrorCode = string & NonNullable<unknown>

/**
 * JSON-serializable error data structure.
 *
 * This is the standard format for error responses in the AT Protocol XRPC protocol.
 *
 * @typeParam N - The specific error code type
 *
 * @example
 * ```typescript
 * import type { LexErrorData } from '@atproto/lex-data'
 *
 * const errorData: LexErrorData = {
 *   error: 'InvalidRequest',
 *   message: 'Missing required field: handle'
 * }
 * ```
 */
export type LexErrorData<N extends LexErrorCode = LexErrorCode> = {
  /** The error code identifying the type of error. */
  error: N
  /** Optional human-readable error message. */
  message?: string
}

export type DownstreamError<N extends LexErrorCode = LexErrorCode> = {
  status: number
  headers?: Headers
  data: LexErrorData<N>
}

/**
 * Error class for Lexicon-related errors.
 *
 * LexError extends the standard JavaScript {@link Error} with AT
 * Protocol-specific functionality including an `error` code property and
 * methods for converting to downstream (XRPC) error responses.
 *
 * @typeParam N - The specific error code type
 */
export abstract class LexError<
  N extends LexErrorCode = LexErrorCode,
> extends Error {
  readonly [kLexError] = kLexError

  name = 'LexError'

  /**
   * @param error - The error code identifying the type of error, typically used in XRPC error payloads
   * @param message - Optional human-readable error message
   * @param options - Standard Error options (e.g., cause)
   */
  constructor(
    readonly error: N,
    readonly message: string = '',
    options?: ErrorOptions,
  ) {
    super(message, options)

    if (this.constructor === LexError) {
      throw new TypeError('LexError is an abstract class')
    }
  }

  /**
   * Returns a string representation of this error.
   *
   * @returns A formatted string: "LexError: [ERROR_CODE] message"
   */
  toString(): string {
    return `${this.name}: [${this.error}] ${this.message}`
  }

  /**
   * Converts this error to a JSON-serializable object.
   *
   * @returns The error data suitable for JSON serialization
   */
  toJSON(): LexErrorData {
    const { error, message } = this
    return { error, message: message || undefined }
  }

  abstract toDownstreamError(): DownstreamError

  /**
   * Allow multiple versions of LexError across package boundaries to be
   * recognized as instances of LexError using `instanceof`, by checking for the
   * presence of the `kLexError` symbol and required properties.
   */
  static [Symbol.hasInstance](instance: unknown): boolean {
    return isLexError(instance)
  }
}

export function isLexError(value: unknown): value is LexError {
  return (
    value instanceof Error &&
    kLexError in value &&
    value[kLexError] === kLexError &&
    hasPropOfType(value, 'name', 'string') &&
    hasPropOfType(value, 'error', 'string') &&
    hasPropOfType(value, 'toJSON', 'function') &&
    hasPropOfType(value, 'toDownstreamError', 'function')
  )
}
