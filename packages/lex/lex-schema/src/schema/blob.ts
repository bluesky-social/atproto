import {
  BlobRef,
  BlobRefCheckOptions,
  LegacyBlobRef,
  isBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type BlobSchemaOptions = BlobRefCheckOptions & {
  /**
   * Whether to allow legacy blob references format
   * @see {@link LegacyBlobRef}
   */
  allowLegacy?: boolean
  /**
   * List of accepted mime types
   */
  accept?: string[]
  /**
   * Maximum size in bytes
   */
  maxSize?: number
}

export type { BlobRef, LegacyBlobRef }

export class BlobSchema<
  const TOptions extends BlobSchemaOptions = NonNullable<unknown>,
> extends Schema<
  TOptions extends { allowLegacy: true } ? BlobRef | LegacyBlobRef : BlobRef
> {
  constructor(readonly options?: TOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const blob: null | BlobRef | LegacyBlobRef =
      (input as any)?.$type !== undefined
        ? isBlobRef(input, this.options)
          ? input
          : null
        : this.options?.allowLegacy === true && isLegacyBlobRef(input)
          ? input
          : null

    if (!blob) {
      return ctx.issueInvalidType(input, 'blob')
    }

    const accept = this.options?.accept
    if (accept && !matchesMime(blob.mimeType, accept)) {
      return ctx.issueInvalidPropertyValue(blob, 'mimeType', accept)
    }

    const maxSize = this.options?.maxSize
    if (maxSize != null && 'size' in blob && blob.size > maxSize) {
      return ctx.issueTooBig(blob, 'blob', maxSize, blob.size)
    }

    return ctx.success(blob)
  }

  matchesMime(mime: string): boolean {
    const accept = this.options?.accept
    if (!accept) return true
    return matchesMime(mime, accept)
  }
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

export const blob = /*#__PURE__*/ memoizedOptions(function <
  O extends BlobSchemaOptions = { allowLegacy?: false },
>(options?: O) {
  return new BlobSchema(options)
})
