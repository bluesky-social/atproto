import {
  BlobRef,
  LegacyBlobRef,
  isBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Configuration options for blob schema validation.
 */
export type BlobSchemaOptions = {
  /**
   * List of accepted MIME types (supports wildcards like 'image/*' or '*\/*')
   *
   * @default undefined // accepts all MIME types
   */
  accept?: string[]

  /**
   * Maximum blob size in bytes
   *
   * @default undefined // no size limit
   */
  maxSize?: number
}

export type { BlobRef, LegacyBlobRef }
export { isBlobRef, isLegacyBlobRef }

/**
 * Schema for validating blob references in AT Protocol.
 *
 * Validates BlobRef objects which contain a CID reference to binary data,
 * along with metadata like MIME type and size. Can optionally accept
 * legacy blob reference format.
 *
 * @template TOptions - The configuration options type
 *
 * @example
 * ```ts
 * const schema = new BlobSchema({ accept: ['image/*'], maxSize: 1000000 })
 * const result = schema.validate(blobRef)
 * ```
 */
export class BlobSchema<
  const TOptions extends BlobSchemaOptions = NonNullable<unknown>,
> extends Schema<BlobRef | LegacyBlobRef> {
  readonly type = 'blob' as const

  constructor(readonly options?: TOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const blob = parseValue.call(ctx, input)
    if (!blob) {
      return ctx.issueUnexpectedType(input, 'blob')
    }

    // In non-strict mode, we allow blob refs to pass through without MIME
    // type or size checks.
    if (ctx.options.strict) {
      const accept = this.options?.accept
      if (accept && !matchesMime(blob.mimeType, accept)) {
        return ctx.issueInvalidPropertyValue(blob, 'mimeType', accept)
      }

      const maxSize = this.options?.maxSize
      if (maxSize != null && 'size' in blob && blob.size > maxSize) {
        return ctx.issueTooBig(blob, 'blob', maxSize, blob.size)
      }
    }

    return ctx.success(blob)
  }

  matchesMime(mime: string): boolean {
    const accept = this.options?.accept
    if (!accept) return true
    return matchesMime(mime, accept)
  }
}

function parseValue(
  this: ValidationContext,
  input: unknown,
): BlobRef | LegacyBlobRef | null {
  // If there is a $type property, we treat if as a potential BlobRef and
  // validate accordingly.
  if ((input as any)?.$type !== undefined) {
    // Use the context's option for the "strict" check
    return isBlobRef(input, this.options) ? input : null
  }

  // If there is no $type property, we may be dealing with a legacy blob ref. If
  // legacy refs are allowed (non-strict mode), we check if the input matches
  // the legacy format.
  if (this.options.strict === false && isLegacyBlobRef(input, this.options)) {
    return input
  }

  return null
}

function matchesMime(mime: string, accepted: string[]): boolean {
  if (accepted.includes('*/*')) return true
  if (accepted.includes(mime)) return true
  for (const value of accepted) {
    if (value.endsWith('/*') && mime.startsWith(value.slice(0, -1))) {
      return true
    }
  }
  return false
}

/**
 * Creates a blob schema for validating blob references with optional constraints.
 *
 * Blob references are used in AT Protocol to reference binary data stored
 * separately from records. They contain a CID, MIME type, and size information.
 *
 * @param options - Optional configuration for MIME type filtering and size limits
 * @returns A new {@link BlobSchema} instance
 *
 * @example
 * ```ts
 * // Basic blob reference
 * const fileSchema = l.blob()
 *
 * // Image files only
 * const imageSchema = l.blob({ accept: ['image/png', 'image/jpeg', 'image/gif'] })
 *
 * // Any image type with size limit
 * const avatarSchema = l.blob({ accept: ['image/*'], maxSize: 1000000 })
 *
 * // Allow legacy format
 * const legacySchema = l.blob({ allowLegacy: true })
 * ```
 */
export const blob = /*#__PURE__*/ memoizedOptions(function <
  O extends BlobSchemaOptions = NonNullable<unknown>,
>(options?: O) {
  return new BlobSchema(options)
})
