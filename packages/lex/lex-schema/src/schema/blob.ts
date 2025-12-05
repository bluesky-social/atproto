import {
  BlobRef,
  LegacyBlobRef,
  isBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../validation.js'

export type BlobSchemaOptions = {
  /**
   * Whether to allow legacy blob references format
   * @see {@link LegacyBlobRef}
   */
  allowLegacy?: boolean
  /**
   * Whether to enforce strict validation on the blob reference (CID version, codec, hash function)
   */
  strict?: boolean
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
    if (!isBlob(input, this.options)) {
      return ctx.issueInvalidType(input, 'blob')
    }

    // @NOTE Historically, we did not enforce constraints on blob references
    // https://github.com/bluesky-social/atproto/blob/4c15fb47cec26060bff2e710e95869a90c9d7fdd/packages/lexicon/src/validators/blob.ts#L5-L19

    // const { accept } = this.options
    // if (accept && !accept.includes(input.mimeType)) {
    //   return ctx.issueInvalidValue(input, accept)
    // }

    // const { maxSize } = this.options
    // if (maxSize != null && input.size != -1 && input.size > maxSize) {
    //   return ctx.issueTooBig(input, 'blob', maxSize, input.size)
    // }

    return ctx.success(input)
  }
}

function isBlob<O extends BlobSchemaOptions>(
  input: unknown,
  options: O,
): input is BlobSchemaOutput<O> {
  if ((input as any)?.$type !== undefined) {
    return isBlobRef(input, options)
  }

  if (options.allowLegacy === true) {
    return isLegacyBlobRef(input)
  }

  return false
}
