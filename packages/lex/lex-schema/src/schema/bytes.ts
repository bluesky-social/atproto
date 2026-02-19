import { asUint8Array, ifUint8Array } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Configuration options for bytes schema validation.
 *
 * @property minLength - Minimum length in bytes
 * @property maxLength - Maximum length in bytes
 */
export type BytesSchemaOptions = {
  minLength?: number
  maxLength?: number
}

/**
 * Schema for validating binary data as Uint8Array with optional length constraints.
 *
 * In "parse" mode, coerces various binary formats (Buffer, ArrayBuffer, etc.)
 * into Uint8Array. In "validate" mode, only accepts Uint8Array directly.
 *
 * @example
 * ```ts
 * const schema = new BytesSchema({ maxLength: 1024 })
 * const result = schema.validate(new Uint8Array([1, 2, 3]))
 * ```
 */
export class BytesSchema extends Schema<Uint8Array> {
  readonly type = 'bytes' as const

  constructor(readonly options: BytesSchemaOptions = {}) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // In "parse" mode, coerce different binary formats into Uint8Array
    const bytes =
      ctx.options.mode === 'parse' ? asUint8Array(input) : ifUint8Array(input)
    if (!bytes) {
      return ctx.issueUnexpectedType(input, 'bytes')
    }

    const { minLength } = this.options
    if (minLength != null && bytes.length < minLength) {
      return ctx.issueTooSmall(bytes, 'bytes', minLength, bytes.length)
    }

    const { maxLength } = this.options
    if (maxLength != null && bytes.length > maxLength) {
      return ctx.issueTooBig(bytes, 'bytes', maxLength, bytes.length)
    }

    return ctx.success(bytes)
  }
}

/**
 * Creates a bytes schema for validating binary data with optional length constraints.
 *
 * Validates Uint8Array values and can coerce other binary formats in parse mode.
 *
 * @param options - Optional configuration for minimum and maximum byte length
 * @returns A new {@link BytesSchema} instance
 *
 * @example
 * ```ts
 * // Basic bytes schema
 * const dataSchema = l.bytes()
 *
 * // With size constraints
 * const avatarSchema = l.bytes({ maxLength: 1000000 }) // 1MB max
 *
 * // With minimum size
 * const hashSchema = l.bytes({ minLength: 32, maxLength: 32 }) // Exactly 32 bytes
 * ```
 */
export const bytes = /*#__PURE__*/ memoizedOptions(function (
  options?: BytesSchemaOptions,
) {
  return new BytesSchema(options)
})
