import {
  BlobRef,
  BlobRefCheckOptions,
  LegacyBlobRef,
  isBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../core.js'

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

export type BlobSchemaOutput<Options> = Options extends { allowLegacy: true }
  ? BlobRef | LegacyBlobRef
  : BlobRef

export class BlobSchema<O extends BlobSchemaOptions> extends Schema<
  BlobSchemaOutput<O>
> {
  constructor(readonly options: O) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<BlobSchemaOutput<O>> {
    const blob: null | BlobRef | LegacyBlobRef =
      (input as any)?.$type !== undefined
        ? isBlobRef(input, this.options)
          ? input
          : null
        : this.options.allowLegacy === true && isLegacyBlobRef(input)
          ? input
          : null

    if (!blob) {
      return ctx.issueInvalidType(input, 'blob')
    }

    const { accept } = this.options
    if (accept && !matchesMime(blob.mimeType, accept)) {
      return ctx.issueInvalidPropertyValue(blob, 'mimeType', accept)
    }

    const { maxSize } = this.options
    if (maxSize != null && 'size' in blob && blob.size > maxSize) {
      return ctx.issueTooBig(blob, 'blob', maxSize, blob.size)
    }

    return ctx.success(blob as BlobSchemaOutput<O>)
  }

  matchesMime(mime: string): boolean {
    const { accept } = this.options
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
