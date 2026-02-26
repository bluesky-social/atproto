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

/**
 * Error class for Lexicon-related errors.
 *
 * LexError extends the standard JavaScript {@link Error} with AT
 * Protocol-specific functionality including an `error` code property and
 * methods for representation as (XRPC) error responses payloads.
 *
 * @typeParam N - The specific error code type
 */
export class LexError<N extends LexErrorCode = LexErrorCode> extends Error {
  name = this.constructor.name

  /**
   * @param error - The error code identifying the type of error, typically used in XRPC error payloads
   * @param message - Optional human-readable error message
   * @param options - Standard Error options (e.g., cause)
   */
  constructor(
    readonly error: N,
    message?: string, // Defaults to empty string in Error constructor
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  /**
   * Returns a string representation of this error.
   *
   * @returns A formatted string: "LexErrorClass: [MyErrorCode] My message"
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
}
